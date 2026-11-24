'use strict';
/**
 * Static file server + WebSocket endpoint for Hometown Clash.
 * Run with: npm start   (listens on PORT, default 3000)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleUpgrade } = require('./ws');
const { Hub } = require('./game');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

const hub = new Hub();

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  const file = path.join(ROOT, path.normalize(pathname));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  if (!req.url || !req.url.startsWith('/ws')) {
    socket.destroy();
    return;
  }
  const conn = handleUpgrade(req, socket);
  if (conn) hub.attach(conn);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Hometown Clash listening on http://0.0.0.0:${PORT}`);
});

hub.start();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
