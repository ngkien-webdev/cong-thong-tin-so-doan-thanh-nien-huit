"""Temporary localhost-only form to preserve user-authorized editor text."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'backend' / 'live-original'
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        page = '<!doctype html><meta charset="utf-8"><title>Sao lưu mã gốc</title><h1>Sao lưu mã gốc vào dự án trên máy</h1><form method="post"><label>Tên tệp<select name="name"><option>Original.gs</option><option>appsscript.json</option></select></label><label>Mã nguồn<textarea name="source" rows="20" cols="100"></textarea></label><button>Lưu bản sao</button></form>'
        self.send_response(200); self.send_header('Content-Type','text/html;charset=utf-8'); self.end_headers(); self.wfile.write(page.encode())
    def do_POST(self):
        size = int(self.headers.get('Content-Length','0'))
        if size > 1000000: self.send_error(413); return
        fields = parse_qs(self.rfile.read(size).decode())
        name = fields.get('name',[''])[0]; source = fields.get('source',[''])[0]
        if name not in ['Original.gs','appsscript.json'] or not source: self.send_error(400); return
        ROOT.mkdir(exist_ok=True)
        target = ROOT / name
        if target.exists(): self.send_error(409,'Backup already exists'); return
        target.write_text(source,encoding='utf-8')
        self.send_response(200); self.send_header('Content-Type','text/html;charset=utf-8'); self.end_headers(); self.wfile.write(('Đã lưu bản gốc: '+name+' · '+str(len(source))+' ký tự').encode())
HTTPServer(('127.0.0.1',8766),Handler).serve_forever()
