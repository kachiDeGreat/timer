const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const DEFAULT_PORT = 3456;

// Standard MIME type mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ iface: name, ip: net.address });
      }
    }
  }
  return addresses;
}

function getPrimaryIp() {
  const ips = getLocalIpAddresses();
  // Prefer Wi-Fi / wlan / en0 / wlp interfaces
  const wifi = ips.find((i) => /wi-?fi|wlan|wlp|en/i.test(i.iface));
  if (wifi) return wifi.ip;
  if (ips.length > 0) return ips[0].ip;
  return '127.0.0.1';
}

const DEFAULT_STATE = {
  totalSeconds: 600,
  remainingSeconds: 600,
  status: 'idle',
  queuedHours: 0,
  queuedMinutes: 10,
  queuedSeconds: 0,
  colorScheme: 'white',
  isBlackout: true,
  lastUpdated: Date.now(),
  lastAction: 'Ready',
  finishedAt: null,
  targetEndTime: null,
  timerQueue: [],
  autoAdvanceMode: 'manual',
  activeQueueItemId: null,
  upNextAlertUntil: null,
  upNextAlertTitle: null,
  upNextTriggerSeconds: 60,
};

class RemoteControlServer {
  constructor() {
    this.server = null;
    this.wss = null;
    this.port = DEFAULT_PORT;
    this.clients = new Set();
    this.currentState = { ...DEFAULT_STATE };
    this.onActionCallback = null;
    this.onClientsChangeCallback = null;
    this.distDir = path.join(__dirname, '../dist');
    this.isDev = false;
    this.heartbeatTimer = null;
  }

  init({ port = DEFAULT_PORT, distDir, isDev = false, onAction, onClientsChange }) {
    this.port = port;
    if (distDir) this.distDir = distDir;
    this.isDev = isDev;
    this.onActionCallback = onAction;
    this.onClientsChangeCallback = onClientsChange;

    return this.start();
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[RemoteServer] Port ${this.port} is in use, trying ${this.port + 1}...`);
          this.port += 1;
          setTimeout(() => {
            this.server.close();
            this.start().then(resolve).catch(reject);
          }, 300);
        } else {
          console.error('[RemoteServer] HTTP Server error:', err);
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        const primaryIp = getPrimaryIp();
        console.log(`[RemoteServer] Running at http://${primaryIp}:${this.port}`);
        this.setupWebSocketServer();
        resolve(this.getServerInfo());
      });
    });
  }

  setupWebSocketServer() {
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (req, socket, head) => {
      try {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        if (url.pathname === '/ws') {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit('connection', ws, req);
          });
          return;
        }
      } catch {
        // ignore
      }
      socket.destroy();
    });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      ws.isAlive = true;
      const remoteIp = req.socket.remoteAddress;
      console.log(`[RemoteServer] Mobile client connected from ${remoteIp} (Total: ${this.clients.size})`);

      if (this.onClientsChangeCallback) {
        this.onClientsChangeCallback(this.clients.size);
      }

      // Send initial state immediately
      if (this.currentState) {
        try {
          ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: this.currentState }));
        } catch {
          // ignore
        }
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(message, ws);
        } catch (e) {
          console.warn('[RemoteServer] Malformed WS message:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[RemoteServer] Mobile client disconnected (Remaining: ${this.clients.size})`);
        if (this.onClientsChangeCallback) {
          this.onClientsChangeCallback(this.clients.size);
        }
      });

      ws.on('error', (err) => {
        console.warn('[RemoteServer] WS Client error:', err);
        this.clients.delete(ws);
      });
    });

    // 15s ping heartbeat to keep connections healthy through mobile sleep/idle
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          ws.terminate();
          this.clients.delete(ws);
          return;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          this.clients.delete(ws);
        }
      });
    }, 15000);
  }

  handleClientMessage(message, senderWs) {
    if (!message) return;

    if (message.type === 'ACTION') {
      const action = message.action;
      if (action && this.onActionCallback) {
        this.onActionCallback(action);
      }
    } else if (message.type === 'REQUEST_STATE') {
      if (this.currentState) {
        try {
          senderWs.send(JSON.stringify({ type: 'SYNC_STATE', payload: this.currentState }));
        } catch {
          // ignore
        }
      }
    } else if (message.type === 'PING') {
      try {
        senderWs.send(JSON.stringify({ type: 'PONG' }));
      } catch {
        // ignore
      }
    }
  }

  broadcastState(state) {
    this.currentState = state;
    if (!this.clients || this.clients.size === 0) return;

    const payloadStr = JSON.stringify({ type: 'SYNC_STATE', payload: state });
    this.clients.forEach((ws) => {
      if (ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(payloadStr);
        } catch (e) {
          console.warn('[RemoteServer] Failed to send state to client:', e);
        }
      }
    });
  }

  broadcastTick(remainingSeconds) {
    if (!this.clients || this.clients.size === 0) return;

    const tickStr = JSON.stringify({ type: 'TICK', remainingSeconds });
    this.clients.forEach((ws) => {
      if (ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(tickStr);
        } catch (e) {
          // ignore
        }
      }
    });
  }

  getServerInfo() {
    const ipAddresses = getLocalIpAddresses();
    const primaryIp = getPrimaryIp();
    const urls = ipAddresses.map((item) => ({
      iface: item.iface,
      ip: item.ip,
      url: `http://${item.ip}:${this.port}`,
    }));

    return {
      active: Boolean(this.server && this.server.listening),
      port: this.port,
      primaryIp,
      primaryUrl: `http://${primaryIp}:${this.port}`,
      ipAddresses: urls,
      clientsCount: this.clients ? this.clients.size : 0,
    };
  }

  handleHttpRequest(req, res) {
    // Enable CORS for API requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/network-info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getServerInfo()));
      return;
    }

    if (pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.currentState || {}));
      return;
    }

    if (pathname === '/api/action' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const action = parsed.action || parsed;
          if (this.onActionCallback && action) {
            this.onActionCallback(action);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Static Asset Serving from dist
    let filePath = path.join(this.distDir, pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(this.distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // Fallback to index.html for SPA routes (e.g. /remote, /projector)
        const indexPath = path.join(this.distDir, 'index.html');
        fs.readFile(indexPath, (readErr, content) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('StageTimer Pro: App files not found. Please build the app with npm run build.');
          } else {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            });
            res.end(content);
          }
        });
      }
    });
  }

  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

const remoteServer = new RemoteControlServer();
module.exports = remoteServer;
