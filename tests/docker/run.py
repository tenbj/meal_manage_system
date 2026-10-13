"""Fresh, bounded Docker acceptance. Never loads production settings or targets existing services."""
import argparse,datetime,hashlib,json,os,secrets,socket,subprocess,sys,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def free_port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def run(args,input=None,timeout=240):
 p=subprocess.Popen(args,cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=os.name!='nt')
 timed_out=False
 try:stdout,stderr=p.communicate(input,timeout=timeout)
 except subprocess.TimeoutExpired:
  timed_out=True
  if os.name=='nt':subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
  else:
   import signal
   os.killpg(p.pid,signal.SIGKILL)
  stdout,stderr=p.communicate(timeout=15)
 if p.returncode or timed_out:
  log='command-failure-'+secrets.token_hex(4)+'.log'
  if 'work' in globals():(work/log).write_bytes(stdout+stderr)
  raise RuntimeError(('Command timed out' if timed_out else 'Command failed')+'; private '+log+' retained: '+str(args[0]))
 return stdout
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
p=argparse.ArgumentParser();p.add_argument('--baseline-image',required=True,help='Existing 0.3 image ID/tag used only with the fresh test database');p.add_argument('--keep-on-failure',action='store_true');p.add_argument('--peer-project',action='append',default=[],help='Exact other agent isolated Compose project; never a production project');p.add_argument('--reuse-build-cache',action='store_true');a=p.parse_args()
assert all(__import__('re').fullmatch(r'h02test-[a-z0-9-]+',peer) for peer in a.peer_project)
project='h02test-meal-'+secrets.token_hex(6);work=ROOT/'.test-runs'/project;work.mkdir(parents=True)
cfg={'DB_HOST':'db','DB_PORT':'3306','DB_NAME':'meal_release_test','DB_USER':'mealtest','DB_PASSWORD':secrets.token_hex(24),'DB_ROOT_PASSWORD':secrets.token_hex(24),'INITIAL_PASSWORD':secrets.token_hex(20),'APP_ACCESS_TOKEN':secrets.token_hex(24),'APP_READ_TOKEN':secrets.token_hex(24),'APP_PORT':str(free_port()),'BIND_ADDRESS':'127.0.0.1','MEAL_IMAGE':project+':target'}
cfg['PUBLIC_URL']='http://127.0.0.1:'+cfg['APP_PORT'];tls_port=free_port();cfg['ADDITIONAL_PUBLIC_URLS']='https://127.0.0.1:'+str(tls_port)
env=work/'test.env';env.write_text('\n'.join(k+'='+v for k,v in cfg.items()),encoding='utf8')
oldenv=work/'old.env';oldenv.write_text('\n'.join(k+'='+(a.baseline_image if k=='MEAL_IMAGE' else v) for k,v in cfg.items()),encoding='utf8')
limits=work/'limits.yaml';limits.write_text('services:\n  db:\n    mem_limit: 512m\n    command: ["--performance-schema=OFF", "--innodb-buffer-pool-size=32M", "--max-connections=30"]\n',encoding='utf8')
ctx={'project':project,'config':cfg};(work/'run.json').write_text(json.dumps(ctx),encoding='utf8')
report={'passed':False,'environment':'isolated','run_id':secrets.token_hex(12),'started_at':now(),'compose_project':project,'mcp_mode':'embedded','checks':[],'private_run':work.name};proxy=None
contract=json.loads((ROOT/'project-contract.json').read_text(encoding='utf8'))
def snapshot():
 files={}
 for value in contract['docker']['inputs']:
  path=ROOT/value
  for item in ([path] if path.is_file() else path.rglob('*')):
   if item.is_file() and not {'node_modules','.git','__pycache__'}&set(item.parts):files[item.relative_to(ROOT).as_posix()]=hashlib.sha256(item.read_bytes()).hexdigest()
 return [{'path':p,'sha256':files[p]} for p in sorted(files)]
report['delivery_id']=contract['delivery_id'];report['inputs']=snapshot()
existing={}
report['excluded_peer_projects']=a.peer_project
report['existing_containers']=existing
def save(): (work/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
def check(name,*observations):report['checks'].append({'name':name,'status':'passed','observations':list(observations)});save();print(name+' passed',flush=True)
def compose(*args,old=False,input=None,timeout=300,app_only=False):
 assert project.startswith('h02test-meal-') and cfg['DB_NAME']=='meal_release_test' and cfg['DB_HOST']=='db'
 files=['-f','compose.yaml'] if app_only else ['-f','compose.yaml','-f','compose.database.yaml','-f',str(limits)]
 return run(['docker','compose','-p',project,'--env-file',str(oldenv if old else env),*files,*args],input,timeout)
def sql(statement):return compose('exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --batch --skip-column-names',input=statement.encode())
def node(code):return compose('exec','-T','app','node','-e',code)
def http(path,method='GET',body=None):
 req=urllib.request.Request(cfg['PUBLIC_URL']+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+cfg['APP_ACCESS_TOKEN'],'Content-Type':'application/json'})
 try:
  with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=15) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,{}
fingerprint="const c=require('crypto'),db=require('./src/db');(async()=>{const out={};for(const t of ['app_users','app_sessions','app_tokens','merchant_workspace','merchant_integrations','api_requests','customers','orders','dishes','recipes','daily_out','feedbacks','labels','deliveries','posters']){const [rows]=await db.getPool().query('SELECT * FROM `'+t+'`');out[t]=c.createHash('sha256').update(JSON.stringify(rows.map(x=>JSON.stringify(x)).sort())).digest('hex')}console.log(JSON.stringify(out));await db.closePool()})().catch(()=>process.exit(1));"
try:
 save();print('Preparing '+project,flush=True)
 for cid in run(['docker','ps','-q']).decode().split():
  d=json.loads(run(['docker','inspect',cid]))[0]
  if d.get('Config',{}).get('Labels',{}).get('com.docker.compose.project') in a.peer_project:continue
  existing[cid]=(d['Image'],d['State']['StartedAt'],d['RestartCount'])
 compose('config','--quiet');compose('config','--quiet',app_only=True);check('compose_config','Application + isolated MySQL + limits and app-only configuration parsed')
 run(['docker','build',* ([] if a.reuse_build_cache else ['--no-cache']),'-t',cfg['MEAL_IMAGE'],'.'],timeout=900)
 report['images']=[{'service':'app','id':run(['docker','image','inspect','--format','{{.Id}}',cfg['MEAL_IMAGE']]).decode().strip()},{'service':'db','id':run(['docker','image','inspect','--format','{{.Id}}','mysql:8.4']).decode().strip()}];check('build','Target build from release working tree; cache='+str(a.reuse_build_cache))
 compose('up','-d','--wait','--wait-timeout','900','db',timeout=960)
 compose('run','--rm','--no-deps','app','node','scripts/migrate.js',old=True)
 compose('up','-d','--no-build','--wait','--wait-timeout','180','app',old=True)
 assert http('/health/ready')[1]['version']=='0.3.0'
 baseline=http('/api/merchant')[1];baseline['state']['customers'].append({'id':'baseline-customer','name':'Synthetic retained customer','fulfillment':'pickup','allergies':[]});assert http('/api/merchant','PUT',baseline)[0]==200;baseline=http('/api/merchant')[1]
 compose('stop','app');backup=compose('exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --set-gtid-purged=OFF "$MYSQL_DATABASE"');(work/'before.sql').write_bytes(backup)
 for _ in range(2):compose('run','--rm','--no-deps','app','node','scripts/migrate.js')
 compose('up','-d','--no-build','--wait','--wait-timeout','180','app');assert http('/api/merchant')[1]==baseline
 assert http('/health/ready')[1]['version']==json.loads((ROOT/'package.json').read_text())['version'];check('startup','Target non-root application and isolated MySQL healthy');check('upgrade','Fresh 0.3 baseline synthetic workspace upgraded twice; exact revision and payload preserved under test')
 output=run(['node','tests/integration/accounts.cjs',str(work/'run.json')]);check('api','Real two-user API isolation, concurrent reads, legacy tables, idempotency and version conflicts');check('mcp','Real SDK handshake/list13/read/write, scopes and owner isolation');check('auth','Registration/login/password/session/token revocation and untrusted origin rejection')
 # Local TLS proxy verifies real browser HTTPS without installing trust or touching cloud configuration.
 from cryptography import x509
 from cryptography.x509.oid import NameOID
 from cryptography.hazmat.primitives import hashes,serialization
 from cryptography.hazmat.primitives.asymmetric import rsa
 key=rsa.generate_private_key(public_exponent=65537,key_size=2048);name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')]);stamp=datetime.datetime.now(datetime.timezone.utc)
 cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(stamp-datetime.timedelta(minutes=1)).not_valid_after(stamp+datetime.timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(__import__('ipaddress').ip_address('127.0.0.1'))]),False).sign(key,hashes.SHA256())
 (work/'tls.key').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()));(work/'tls.crt').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
 proxy=subprocess.Popen(['node','tests/support/tls-proxy.cjs',str(tls_port),cfg['PUBLIC_URL'],str(work/'tls.key'),str(work/'tls.crt')],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 time.sleep(1);run(['node','tests/integration/browser.cjs',str(work/'run.json')],timeout=240)
 for name in ['architecture','erd']:
  req=urllib.request.Request(cfg['PUBLIC_URL']+'/diagrams/'+name+'.html',headers={'Authorization':'Bearer '+cfg['APP_ACCESS_TOKEN']})
  with urllib.request.urlopen(req) as r:assert r.read()==(ROOT/'docs/diagrams'/f'{name}.html').read_bytes()
 check('diagrams','Container bytes match both published HTML; real browser ER toggle20/details/hide/show and offline pages passed; real HTTP/TLS login and mobile registration passed')
 users=json.loads((work/'users.json').read_text());ids=[x['id'] for x in users]
 node("const {identity}=require('./src/identity'),s=require('./src/integrations').createIntegrationStore();Promise.all("+json.dumps(ids)+".map(id=>identity.run({id},async()=>{await s.save('synthetic-owner-'+id,0);if(await s.readKey()!=='synthetic-owner-'+id)throw Error('Isolation')}))).then(()=>require('./src/db').closePool()).catch(()=>process.exit(1));")
 before=node(fingerprint);node("require('fs').writeFileSync('.runtime/probe','synthetic');if(process.getuid()===0)process.exit(1)")
 compose('up','-d','--no-build','--force-recreate','--wait','--wait-timeout','900','db','app',timeout=960);assert node(fingerprint)==before;assert b'synthetic' in node("console.log(require('fs').readFileSync('.runtime/probe','utf8'))");check('recreate','Recreated app and database containers retained all 15 table hashes, per-user integration credentials and runtime file')
 compose('stop','app');backup2=compose('exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --set-gtid-purged=OFF "$MYSQL_DATABASE"');(work/'after.sql').write_bytes(backup2)
 sql("CREATE DATABASE meal_restore_test; GRANT ALL ON meal_restore_test.* TO 'mealtest'@'%'; CREATE DATABASE meal_rollback_test; GRANT ALL ON meal_rollback_test.* TO 'mealtest'@'%';")
 compose('exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot meal_restore_test',input=backup2)
 assert compose('run','--rm','--no-deps','-e','DB_NAME=meal_restore_test','app','node','-e',fingerprint)==before;check('backup_restore','Consistent dump restored into independent test database; all 15 hashes equal; same isolated MySQL instance')
 compose('exec','-T','db','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot meal_rollback_test',input=backup)
 old=json.loads(compose('run','--rm','--no-deps','-e','DB_NAME=meal_rollback_test','app','node','-e',"require('./src/db').getPool().query('SELECT revision,payload FROM merchant_workspace WHERE id=1').then(([r])=>{console.log(JSON.stringify(r[0]));return require('./src/db').closePool()})",old=True));assert old['revision']==baseline['revision'] and old['payload']==baseline['state'];check('rollback','Old 0.3 image reads separate restored pre-account schema; upgraded database never rolled back')
 compose('up','-d','--no-build','--wait','app');compose('stop','db');assert http('/health/ready')[0]==503 and http('/api/merchant')[0]==503
 compose('up','-d','--wait','--wait-timeout','900','db',timeout=960)
 for _ in range(30):
  if http('/health/ready')[0]==200:break
  time.sleep(2)
 assert node(fingerprint)==before;check('failure_recovery','Dependency outage gives 503, recovery reconnects without app restart; all table hashes retained')
 # App-only configuration connects to an existing test MySQL on the same isolated network.
 compose('up','-d','--no-deps','--no-build','--force-recreate','--wait','app',app_only=True);assert http('/api/merchant')[0]==200;report['app_only_verified']=True
 assert snapshot()==report['inputs'],'Source inputs changed during acceptance; evidence rejected'
 report['runtime_passed']=True
except Exception as e:
 report['error']=str(e);save();print('Acceptance failed; private diagnostic retained',flush=True)
finally:
 try:
  if proxy:proxy.terminate();proxy.wait(timeout=15)
  if report.get('runtime_passed') or not a.keep_on_failure:
   compose('down','--volumes','--remove-orphans',timeout=300)
   for cid,expected in existing.items():
    d=json.loads(run(['docker','inspect',cid]))[0];assert (d['Image'],d['State']['StartedAt'],d['RestartCount'])==expected
   check('cleanup','Removed only '+project+' resources; every pre-existing container image/start/restart count unchanged')
 except Exception as e:
  report['cleanup_error']=str(e);print('Cleanup incomplete; original failure and private diagnostic retained',flush=True)
 report['finished_at']=now();save();print(str(work/'report.json'),flush=True)
if report.get('error') or report.get('cleanup_error'):raise SystemExit(1)
