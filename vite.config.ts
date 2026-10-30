import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { WebSocketServer } from 'ws'

function remoteSyncPlugin(): Plugin {
  let currentState: any = null;
  const clients = new Set<any>();

  return {
    name: 'stagetimer-remote-sync',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/network-info') {
          import('os').then((os) => {
            const interfaces = os.networkInterfaces();
            const ips: Array<{ iface: string; ip: string; url: string }> = [];
            let primaryIp = '127.0.0.1';
            for (const name of Object.keys(interfaces)) {
              for (const net of interfaces[name] || []) {
                if (net.family === 'IPv4' && !net.internal) {
                  ips.push({ iface: name, ip: net.address, url: `http://${net.address}:5173` });
                  if (/wi-?fi|wlan|wlp|en/i.test(name)) primaryIp = net.address;
                }
              }
            }
            if (primaryIp === '127.0.0.1' && ips.length > 0) primaryIp = ips[0].ip;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                active: true,
                port: 5173,
                primaryIp,
                primaryUrl: `http://${primaryIp}:5173`,
                ipAddresses: ips,
                clientsCount: clients.size,
              })
            );
          });
          return;
        }

        if (req.url === '/api/state') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(currentState || null));
            return;
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                currentState = parsed.state || parsed;
                const syncMsg = JSON.stringify({ type: 'SYNC_STATE', payload: currentState });
                clients.forEach((c) => {
                  if (c.readyState === 1) c.send(syncMsg);
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        if (req.url === '/api/action' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const action = parsed.action || parsed;
              const relayMsg = JSON.stringify({ type: 'ACTION_RELAY', action });
              clients.forEach((c) => {
                if (c.readyState === 1) c.send(relayMsg);
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });

      if (!server.httpServer) return;
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (req, socket, head) => {
        try {
          const url = new URL(req.url || '', 'http://localhost');
          if (url.pathname === '/ws') {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit('connection', ws, req);
            });
            return;
          }
        } catch {
          // ignore, let Vite HMR handle it
        }
      });

      wss.on('connection', (ws) => {
        clients.add(ws);
        if (currentState) {
          try {
            ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: currentState }));
          } catch {
            // ignore
          }
        } else {
          // Ask any connected host client to provide its state
          const reqMsg = JSON.stringify({ type: 'REQUEST_STATE' });
          clients.forEach((c) => {
            if (c !== ws && c.readyState === 1) c.send(reqMsg);
          });
        }

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'ACTION') {
              const relayMsg = JSON.stringify({ type: 'ACTION_RELAY', action: msg.action });
              clients.forEach((c) => {
                if (c.readyState === 1) c.send(relayMsg);
              });
            } else if (msg.type === 'REQUEST_STATE') {
              if (currentState) {
                try {
                  ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: currentState }));
                } catch {
                  // ignore
                }
              } else {
                const reqMsg = JSON.stringify({ type: 'REQUEST_STATE' });
                clients.forEach((c) => {
                  if (c !== ws && c.readyState === 1) c.send(reqMsg);
                });
              }
            } else if (msg.type === 'SYNC_STATE' && msg.payload) {
              if (!currentState || msg.payload.lastUpdated >= (currentState.lastUpdated || 0)) {
                currentState = msg.payload;
                const syncMsg = JSON.stringify({ type: 'SYNC_STATE', payload: currentState });
                clients.forEach((c) => {
                  if (c !== ws && c.readyState === 1) c.send(syncMsg);
                });
              }
            } else if (msg.type === 'TICK') {
              const tickMsg = JSON.stringify(msg);
              clients.forEach((c) => {
                if (c !== ws && c.readyState === 1) c.send(tickMsg);
              });
            }
          } catch {
            // ignore
          }
        });

        ws.on('close', () => clients.delete(ws));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [react(), remoteSyncPlugin()],
})

