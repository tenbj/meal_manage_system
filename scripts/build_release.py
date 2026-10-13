"""Package only public source, documentation and current verification evidence."""
import hashlib,json,re,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAMES=['package.json','package-lock.json','README.md','CHANGELOG.md','LICENSE','project-contract.json','Dockerfile','.dockerignore','.gitignore','.gitattributes','.env.example','compose.yaml','compose.database.yaml','compose.resources.yaml']
DIRECTORIES=['src','public','static','data','docs','examples','scripts','tests','prototype-source','.github','verification']
def main():
 files=[ROOT/n for n in NAMES]
 for d in DIRECTORIES:files.extend(p for p in (ROOT/d).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
 files=sorted(set(files)); forbidden=[]
 for p in files:
  rel=p.relative_to(ROOT)
  if any(x in {'private','.git','.test-runs','node_modules','.runtime'} for x in rel.parts) or (p.name.startswith('.env') and p.name!='.env.example') or p.suffix in {'.key','.pem','.sql.gz','.tar'}:forbidden.append(str(rel))
  if re.search(rb'sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY',p.read_bytes()):forbidden.append(str(rel))
 if forbidden:raise RuntimeError('Private paths/content rejected: '+','.join(forbidden))
 version=json.loads((ROOT/'package.json').read_text(encoding='utf8'))['version'];out=ROOT/'dist';out.mkdir(exist_ok=True);target=out/f'meal-management-{version}.zip'
 manifest=[{'path':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files if p.name!='release-scan.json']
 scan=ROOT/'verification/release-scan.json'
 if scan not in files:files.append(scan)
 report={'passed':True,'files':len(files),'archive':'dist/'+target.name,'content_manifest_sha256':hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest(),'scope':'Explicit public paths; no private configuration, runtime, backups, dependencies or image archives; credential pattern scan. Full new-commit/known-secret audit recorded separately.'}
 scan.write_text(json.dumps(report,indent=2),encoding='utf8',newline='\n')
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
  for p in files:z.write(p,p.relative_to(ROOT).as_posix())
 digest=hashlib.sha256(target.read_bytes()).hexdigest();target.with_suffix('.zip.sha256').write_text(digest+'  '+target.name+'\n',encoding='ascii',newline='\n');print(json.dumps({'archive':str(target),'sha256':digest,'files':len(files)}))
if __name__=='__main__':main()
