"""Read every Docker image layer (including gzip) and reject private fixture values."""
import argparse,gzip,json,re,subprocess,tarfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--image',required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[2];context=Path(a.context).resolve();assert context.is_relative_to(root/'.test-runs')
ctx=json.loads(context.read_text());assert re.fullmatch('h02test-meal-[0-9a-f]{12}',ctx['project'])
private=context.parent;report=json.loads((private/'report.json').read_text());needles=[v.encode() for k,v in ctx['config'].items() if k in ['DB_PASSWORD','DB_ROOT_PASSWORD','APP_ACCESS_TOKEN','APP_READ_TOKEN','INITIAL_PASSWORD']]
archive=private/'image.tar';subprocess.run(['docker','save','--output',str(archive),a.image],check=True,timeout=600)
inspected=json.loads(subprocess.check_output(['docker','image','inspect',a.image]))[0];assert inspected['Config']['User']=='node'
metadata=json.dumps(inspected).encode()+subprocess.check_output(['docker','history','--no-trunc',a.image]);assert not any(x in metadata for x in needles)
scanned=0;layers=0
with tarfile.open(archive) as tf:
 for member in tf:
  if not member.isfile():continue
  stream=tf.extractfile(member);data=stream.read();scanned+=len(data)
  assert not any(x in data for x in needles),'Private fixture credential found in image'
  if data[:2]==b'\x1f\x8b':
   decoded=gzip.decompress(data);scanned+=len(decoded);assert not any(x in decoded for x in needles);layers+=1
  elif data[:4]==b'\x28\xb5\x2f\xfd':raise RuntimeError('Unsupported zstd layer; do not report passed')
  elif member.name.endswith('/layer.tar'):layers+=1
report['checks']=[x for x in report['checks'] if x['name']!='secrets']+[{'name':'secrets','status':'passed','observations':['Build allowlist excludes private/runtime/tests; image non-root config/history and all file layers scanned','Scanned bytes: '+str(scanned)]}]
report['passed']=report.get('runtime_passed') is True and len({x['name'] for x in report['checks'] if x['status']=='passed'})==14
(private/'report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({'passed':report['passed'],'image':inspected['Id'],'scanned_bytes':scanned,'layers':layers}))
