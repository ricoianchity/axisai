// dev-server.js — rode com: node dev-server.js
// Requer: ANTHROPIC_API_KEY no ambiente ou num arquivo .env

require('dotenv').config();
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const PORT    = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY não encontrada. Crie um arquivo .env com: ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

const server = http.createServer((req, res) => {

  // ── Proxy endpoint ───────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length':  Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── OPTIONS preflight ────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ── Serve static files ───────────────────────────────────────────────────
  const filePath = req.url === '/'
    ? path.join(__dirname, 'public', 'AxisAI — Performance OS.html')
    : path.join(__dirname, 'public', req.url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ AxisAI rodando em http://localhost:${PORT}`);
  console.log(`🔑 API Key carregada: ${API_KEY.substring(0, 15)}...`);
});
