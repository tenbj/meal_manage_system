"""默认只读；--write-demo 仅限明确选定的隔离系统。"""
import argparse,json,os,uuid,urllib.request
p=argparse.ArgumentParser();actions=p.add_mutually_exclusive_group();actions.add_argument('--write-demo',action='store_true');actions.add_argument('--configure-boohee',action='store_true',help='从本进程BOOHEE_API_KEY私有环境读取，验证并保存连接');actions.add_argument('--migrate-legacy-boohee',action='store_true');a=p.parse_args()
base=os.environ.get('MEAL_URL','http://localhost:3200');token=os.environ['MEAL_TOKEN']
def call(route,body=None):
    req=urllib.request.Request(base+route,data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
print(call('/api/health')['version']);state=call('/api/merchant');print({'revision':state['revision'],'customers':len(state['state']['customers'])})
if a.write_demo:
    result=call('/api/v1/customers',{'request_id':str(uuid.uuid4()),'expected_version':state['revision'],'evidence':'用户显式运行隔离示例','name':'演示客户','fulfillment':'pickup'})
    print({'ok':result['ok'],'revision':result['revision']})
if a.configure_boohee:
    current=call('/api/merchant/nutrition/status');result=call('/api/merchant/nutrition/connect',{'apiKey':os.environ['BOOHEE_API_KEY'],'expectedVersion':current['version']});print({'configured':result['configured'],'version':result['version']})
if a.migrate_legacy_boohee:
    result=call('/api/merchant/nutrition/migrate-legacy',{});print({'configured':result['configured'],'version':result['version']})
