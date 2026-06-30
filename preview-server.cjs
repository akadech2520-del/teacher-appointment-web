const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || 4173);
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxZZddnOot0W_x-Sy01Frt4nzKNPvs6Uvyr3Li3fdJQ_IdCZmSewXrzFaK7ZB1RlYNd/exec';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

async function proxyGas(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '');

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      const targetUrl = GAS_API_URL + query;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: req.method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
        body: req.method === 'POST' ? body : undefined,
        redirect: 'follow'
      });
      const text = await response.text();
      send(res, response.status, text, response.headers.get('content-type') || 'text/plain; charset=utf-8');
    } catch (error) {
      send(res, 502, JSON.stringify({
        status: 'error',
        message: error.message || String(error)
      }), 'application/json; charset=utf-8');
    }
  });
}

function serveFile(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = 'index.html';
  urlPath = urlPath.replace(/^\/+/, '');

  const filePath = path.resolve(ROOT, urlPath);
  if (!filePath.startsWith(path.resolve(ROOT))) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, body) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, body, MIME_TYPES[path.extname(filePath)] || 'application/octet-stream');
  });
}

const server = http.createServer((req, res) => {
  if ((req.url || '').startsWith('/gas')) return proxyGas(req, res);
  return serveFile(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Preview server: http://127.0.0.1:${PORT}/`);
});
