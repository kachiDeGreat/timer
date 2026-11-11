import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { WebSocketServer } from 'ws'
import fs from 'fs'
import path from 'path'

function remoteSyncPlugin(): Plugin {
  let currentState: any = null;
  const clients = new Set<any>();
  const processedActionIds = new Map<string, number>();

  const dispatchRelayAction = (action: any) => {
    if (!action || !action.type) return;
    const actionId = action.actionId;
    if (actionId) {
      const now = Date.now();
      for (const [id, ts] of processedActionIds.entries()) {
        if (now - ts > 10000) processedActionIds.delete(id);
      }
      if (processedActionIds.has(actionId)) return;
      processedActionIds.set(actionId, now);
    }
    const relayMsg = JSON.stringify({ type: 'ACTION_RELAY', action });
    clients.forEach((c) => {
      if (c.readyState === 1) c.send(relayMsg);
    });
  };

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

        if (req.url === '/api/settings') {
          const settingsPath = path.resolve(process.cwd(), 'settings.json');
          if (req.method === 'GET') {
            try {
              if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
                return;
              }
            } catch (err) {
              console.warn('[vite] Failed to read settings.json:', err);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                idleDisplayMode: 'zero',
                clockFormat24: false,
                autoAdvanceMode: 'manual',
                upNextTriggerSeconds: 60,
                colorScheme: 'white',
              })
            );
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
                let current = {
                  idleDisplayMode: 'zero',
                  clockFormat24: false,
                  autoAdvanceMode: 'manual',
                  upNextTriggerSeconds: 60,
                  colorScheme: 'white',
                };
                if (fs.existsSync(settingsPath)) {
                  try {
                    current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                  } catch {}
                }
                const updated = { ...current, ...parsed };
                delete updated.timerQueue;
                fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, settings: updated }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        if (req.url === '/api/queue') {
          const queuePath = path.resolve(process.cwd(), 'queue.json');
          if (req.method === 'GET') {
            try {
              if (fs.existsSync(queuePath)) {
                const data = fs.readFileSync(queuePath, 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
                return;
              }
            } catch (err) {
              console.warn('[vite] Failed to read queue.json:', err);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify([]));
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
                const list = Array.isArray(parsed) ? parsed : (parsed.timerQueue || []);
                fs.writeFileSync(queuePath, JSON.stringify(list, null, 2), 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, queue: list }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        // =========================================================
        // TIMING REPORTS LOG API (30-DAY RETENTION)
        // =========================================================
        const reportsDir = path.resolve(process.cwd(), 'timing_reports');

        const ensureReportsDir = () => {
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
          }
        };

        const cleanupOldReports = (maxAgeDays = 30) => {
          try {
            ensureReportsDir();
            const files = fs.readdirSync(reportsDir);
            const now = Date.now();
            const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

            for (const file of files) {
              const filePath = path.join(reportsDir, file);
              try {
                const stats = fs.statSync(filePath);
                if (!stats.isFile()) continue;

                let ageMs = now - stats.mtimeMs;
                const match = file.match(/timing-report-(\d{4}-\d{2}-\d{2})/);
                if (match) {
                  const fileDate = new Date(match[1]).getTime();
                  if (!isNaN(fileDate)) {
                    ageMs = Math.max(ageMs, now - fileDate);
                  }
                }

                if (ageMs > maxAgeMs) {
                  fs.unlinkSync(filePath);
                  console.log(`[vite] Cleaned up timing report older than 30 days: ${file}`);
                }
              } catch {}
            }
          } catch {}
        };

        const getTodayReportDate = () => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        if (req.url === '/api/timing-reports/today' && req.method === 'GET') {
          ensureReportsDir();
          cleanupOldReports(30);
          const dateStr = getTodayReportDate();
          const jsonPath = path.join(reportsDir, `timing-report-${dateStr}.json`);
          if (fs.existsSync(jsonPath)) {
            try {
              const data = fs.readFileSync(jsonPath, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            } catch {}
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([]));
          return;
        }

        if (req.url === '/api/timing-reports' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const entry = JSON.parse(body);
              if (entry && entry.eventType) {
                ensureReportsDir();
                cleanupOldReports(30);

                const dateStr = getTodayReportDate();
                const logPath = path.join(reportsDir, `timing-report-${dateStr}.log`);
                const jsonPath = path.join(reportsDir, `timing-report-${dateStr}.json`);

                const timeStr = entry.timeFormatted || new Date(entry.timestamp || Date.now()).toLocaleTimeString();
                const planned = entry.plannedDurationSeconds ? ` | Planned: ${entry.plannedDurationSeconds}s` : '';
                const actual = entry.actualDurationSeconds ? ` | Actual: ${entry.actualDurationSeconds}s` : '';
                const overtime = entry.overtimeSeconds ? ` | Overtime: +${entry.overtimeSeconds}s` : '';
                const notes = entry.notes ? ` | Notes: "${entry.notes}"` : '';
                const logLine = `[${dateStr} ${timeStr}] [${entry.eventType}] Label: "${entry.label || 'Live Timer'}"${planned}${actual}${overtime}${notes}\n`;

                fs.appendFileSync(logPath, logLine, 'utf8');

                let jsonEntries: any[] = [];
                if (fs.existsSync(jsonPath)) {
                  try {
                    jsonEntries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    if (!Array.isArray(jsonEntries)) jsonEntries = [];
                  } catch {}
                }
                jsonEntries = [entry, ...jsonEntries.filter((e: any) => e.id !== entry.id)].slice(0, 500);
                fs.writeFileSync(jsonPath, JSON.stringify(jsonEntries, null, 2), 'utf8');

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, logPath, jsonPath }));
                return;
              }
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false }));
          });
          return;
        }

        if (req.url === '/api/timing-reports/clear' && req.method === 'POST') {
          ensureReportsDir();
          const dateStr = getTodayReportDate();
          const jsonPath = path.join(reportsDir, `timing-report-${dateStr}.json`);
          const logPath = path.join(reportsDir, `timing-report-${dateStr}.log`);

          if (fs.existsSync(jsonPath)) {
            fs.writeFileSync(jsonPath, JSON.stringify([], null, 2), 'utf8');
          }
          const auditLine = `[${dateStr} ${new Date().toLocaleTimeString()}] [AUDIT] Timing report cleared by operator\n`;
          fs.appendFileSync(logPath, auditLine, 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (req.url === '/api/timing-reports/open' && req.method === 'POST') {
          ensureReportsDir();
          const cmd = process.platform === 'win32' ? `start "" "${reportsDir}"` : process.platform === 'darwin' ? `open "${reportsDir}"` : `xdg-open "${reportsDir}"`;
          import('child_process').then(({ exec }) => {
            exec(cmd, () => {});
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folder: reportsDir }));
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
              dispatchRelayAction(action);
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
              dispatchRelayAction(msg.action);
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

