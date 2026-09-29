from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote, urljoin
import subprocess,json,sys
root=Path(__file__).resolve().parents[1]; errors=[]
class Parser(HTMLParser):
    def __init__(self,path):super().__init__();self.path=path;self.ids=set();self.base='https://local.test/'+path.relative_to(root).as_posix()
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='base' and a.get('href'):self.base=urljoin(self.base,a['href'])
        if a.get('id'):
            if a['id'] in self.ids:errors.append(f'{self.path}: duplicate ID {a["id"]}')
            self.ids.add(a['id'])
        for key in (['src'] if tag=='script' else ['href'] if tag=='link' else []):
            val=a.get(key,'');u=urlsplit(val)
            if not val or u.scheme or u.netloc:continue
            resolved=urlsplit(urljoin(self.base,val))
            if resolved.netloc!='local.test':continue
            target=root/unquote(resolved.path).lstrip('/')
            if not target.exists():errors.append(f'{self.path}: missing asset {val}')
for p in root.rglob('*.html'):
    if '.firebase' in p.parts:continue
    Parser(p).feed(p.read_text(encoding='utf-8'))
for p in [*root.rglob('*.js'),*root.rglob('*.gs')]:
    if 'node_modules' in p.parts:continue
    result=subprocess.run(['node','--check','--input-type=module'],input=p.read_text(encoding='utf-8'),text=True,encoding='utf-8',capture_output=True,timeout=20)
    if result.returncode:errors.append(f'{p}: {result.stderr}')
for p in [root/'firebase.json',root/'firestore.indexes.json',root/'backend/appsscript.json']:
    try:json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:errors.append(f'{p}: {e}')
print('\n'.join(errors) if errors else 'PASS: JavaScript syntax, JSON, local assets and unique HTML IDs.')
sys.exit(bool(errors))
