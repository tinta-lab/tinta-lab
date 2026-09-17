// Standalone HTTPS -> HTTP proxy, staging-only. Not part of the app.
//
// Why this exists: the real auth cookie is `secure: true` (see
// backend/src/auth/auth-cookie.constants.ts) — a browser only stores/sends
// it over HTTPS. The staging backend itself stays plain HTTP (matching how
// production's NestJS process is also plain HTTP internally, with TLS
// terminated externally by Cloudflare) — this script is the local stand-in
// for that external TLS termination, so no application code has to change
// for staging to work.
//
// Usage: node https-proxy.js <listenPort> <targetHost> <targetPort>
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const [, , listenPortArg, targetHostArg, targetPortArg] = process.argv;
const listenPort = Number(listenPortArg);
const targetHost = targetHostArg || 'localhost';
const targetPort = Number(targetPortArg);

if (!listenPort || !targetPort) {
  console.error('Usage: node https-proxy.js <listenPort> <targetHost> <targetPort>');
  process.exit(1);
}

const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/cert.pem')),
};

function proxy(req, res) {
  const forwarded = http.request(
    {
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (targetRes) => {
      res.writeHead(targetRes.statusCode, targetRes.headers);
      targetRes.pipe(res);
    },
  );
  forwarded.on('error', (err) => {
    res.writeHead(502);
    res.end(`Staging proxy: upstream error: ${err.message}`);
  });
  req.pipe(forwarded);
}

// WebSocket upgrade (e.g. Next.js/Turbopack HMR) isn't handled by the
// request listener above — Node only relays it if we handle the server's
// separate 'upgrade' event ourselves, splicing the raw sockets together.
function handleUpgrade(req, clientSocket, head) {
  const forwarded = http.request({
    host: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  forwarded.on('upgrade', (targetRes, targetSocket, targetHead) => {
    const headerLines = Object.entries(targetRes.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');
    clientSocket.write(
      `HTTP/1.1 ${targetRes.statusCode} ${targetRes.statusMessage}\r\n${headerLines}\r\n\r\n`,
    );
    if (targetHead && targetHead.length) targetSocket.unshift(targetHead);
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  });
  forwarded.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => forwarded.destroy());
  if (head && head.length) forwarded.write(head);
  forwarded.end();
}

const server = https.createServer(options, proxy);
server.on('upgrade', handleUpgrade);
server.listen(listenPort, () => {
  console.log(`[staging-proxy] https://localhost:${listenPort} -> http://${targetHost}:${targetPort}`);
});
