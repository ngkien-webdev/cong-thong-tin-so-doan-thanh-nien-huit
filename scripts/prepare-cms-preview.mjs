import fs from 'node:fs';
const root=new URL('../',import.meta.url);
let html=fs.readFileSync(new URL('dang-bai/index.html',root),'utf8').replace('href="style.css"','href="../dang-bai/style.css"').replace('src="script.js"','src="cms-fixture.js"').replace('<body>','<body><div style="padding:10px;background:#fff4ce;color:#5b4500;text-align:center;font:12px system-ui">BẢN KIỂM TRA · DỮ LIỆU GIẢ LẬP · KHÔNG ĐĂNG LÊN HỆ THỐNG THẬT</div>');
fs.writeFileSync(new URL('tests/cms-preview.html',root),html);
