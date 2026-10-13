"""Read every Docker image layer (including gzip) and reject private fixture values."""
import argparse,gzip,io,json,re,subprocess,tarfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--image',required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[2];context=Path(a.context).resolve();assert context.is_relative_to(root/'.test-runs')
ctx=json.loads(context.read_text());assert re.fullmatch('h02test-meal-[0-9a-f]{12}',ctx['project'])
private=context.parent;report=json.loads((private/'report.json').read_text());needles=[v.encode() for k,v in ctx['config'].items() if k in ['DB_PASSWORD','DB_ROOT_PASSWORD','APP_ACCESS_TOKEN','APP_READ_TOKEN','INITIAL_PASSWORD']]
archive=private/'image.tar';subprocess.run(['docker','save','--output',str(archive),a.image],check=True,timeout=600)
inspected=json.loads(subprocess.check_output(['docker','image','inspect',a.image]))[0];assert inspected['Config']['User']=='node'
assert inspected['Id']==next(x['id'] for x in report['images'] if x['service']=='app'),'Image differs from accepted runtime'
metadata=json.dumps(inspected).encode()+subprocess.check_output(['docker','history','--no-trunc',a.image]);assert not any(x in metadata for x in needles)
scanned=0;layers=0
def scan(stream):
 global scanned
 tail=b'';overlap=max(map(len,needles))-1
 while block:=stream.read(1024*1024):
  scanned+=len(block);data=tail+block
  assert not any(x in data for x in needles),'Private fixture credential found in image'
  tail=data[-overlap:]
with tarfile.open(archive) as tf:
 for member in tf:
  if not member.isfile():continue
  stream=io.BufferedReader(tf.extractfile(member));signature=stream.peek(4)[:4]
  if signature[:2]==b'\x1f\x8b':
   with gzip.GzipFile(fileobj=stream) as decoded:scan(decoded)
   layers+=1
  elif signature==b'\x28\xb5\x2f\xfd':raise RuntimeError('Unsupported zstd layer; do not report passed')
  else:
   scan(stream)
   if member.name.endswith('/layer.tar'):layers+=1
report['checks']=[x for x in report['checks'] if x['name']!='secrets']+[{'name':'secrets','status':'passed','observations':['Build allowlist excludes private/runtime/tests; image non-root config/history and all file layers scanned','Scanned bytes: '+str(scanned)]}]
report['passed']=report.get('runtime_passed') is True and not report.get('error') and not report.get('cleanup_error') and len({x['name'] for x in report['checks'] if x['status']=='passed'})==14
(private/'report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({'passed':report['passed'],'image':inspected['Id'],'scanned_bytes':scanned,'layers':layers}))
