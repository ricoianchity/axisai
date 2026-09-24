// Local development server. API requests use the same authorization and quota
// checks as the deployed Edge function.
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_ROOT = path.resolve(__dirname, 'public');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    try {
      const { default: chat } = await import('./api/chat.js');
      const request = new Request(`http://localhost:${PORT}/api/chat`, {
        method: 'POST',
        headers: req.headers,
        body: req,
        duplex: 'half',
      });
      const response = await chat(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Chat unavailable' }));
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('Method not allowed');
    return;
  }

  let filePath;
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    filePath = path.resolve(PUBLIC_ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
  } catch {
    res.writeHead(400);
    res.end('Invalid path');
    return;
  }
  if (!filePath.startsWith(PUBLIC_ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text/plain' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AxisOS local: http://127.0.0.1:${PORT}`);
});
