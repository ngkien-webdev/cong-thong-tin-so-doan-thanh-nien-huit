import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const pages = [['admin','index.html'],['dang-bai','index.html'],['diem-ren-luyen','index.html'],['faq','index.html'],['ho-so','index.html'],['ho-so','login.html'],['tin-tuc','index.html'],['van-hoa-hcm','index.html'],['vinh-quang','index.html']];
for (const [dir,name] of pages) {
  const file = new URL(`${dir}/${name}`, root);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('<base ')) continue;
  fs.writeFileSync(file, source.replace('<head>', `<head><base href="/${dir}/">`));
}
