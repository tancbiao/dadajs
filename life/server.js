/* 人生模拟器 · 零依赖本地服务器
 * 作用：
 *   1. 用 http://localhost:8787 打开游戏（比 file:// 更稳，localStorage 也不会被限制）
 *   2. 提供 /api/chat 中转，绕开浏览器直连大模型 API 的 CORS 限制
 *
 * 启动： node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.webp':'image/webp', '.woff2':'font/woff2'
};

function sendJSON(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'Content-Type, Authorization',
      'Access-Control-Allow-Methods':'POST, GET, OPTIONS'
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');

  /* ---------- 大模型中转 ---------- */
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 2 * 1024 * 1024) { req.destroy(); }
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const base = (body._base || process.env.API_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
        const key = body._key || process.env.API_KEY || '';
        if (!key) return sendJSON(res, 400, { error: { message: '缺少 API Key' } });

        // 除私有字段外全部透传（thinking / response_format / temperature 等）
        const payload = Object.assign({}, body);
        delete payload._base;
        delete payload._key;
        payload.model = payload.model || process.env.API_MODEL || 'deepseek-flash';
        payload.messages = payload.messages || [];
        payload.stream = false;

        const r = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key },
          body: JSON.stringify(payload)
        });
        const txt = await r.text();
        res.writeHead(r.status, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' });
        res.end(txt);
      } catch (e) {
        sendJSON(res, 500, { error: { message: '中转失败：' + e.message } });
      }
    });
    return;
  }

  /* ---------- 静态文件 ---------- */
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  人生模拟器已启动');
  console.log('  打开： http://localhost:' + PORT);
  console.log('  API 中转： http://localhost:' + PORT + '/api/chat');
  console.log('  在游戏设置里把"本地中转"填成上面这个地址即可。');
  console.log('');
});
