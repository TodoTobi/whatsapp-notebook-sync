const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3030;

// Estado compartido — lo actualiza index.js, lo lee el dashboard
const serverState = {
  running:     false,
  totalSynced: 0,
  cycles:      0,
  errors:      0,
  lastSync:    null,
  chatName:    "—",
  nextSyncIn:  60,
  logs:        []   // { time, type, msg }
};

const MAX_LOGS = 200;

// ── API pública ───────────────────────────────────────────────────────────────

function addLog(type, msg) {
  const time = new Date().toLocaleTimeString("es-AR", { hour12: false });
  serverState.logs.push({ time, type, msg });
  if (serverState.logs.length > MAX_LOGS) serverState.logs.shift();
}

function setState(patch) {
  Object.assign(serverState, patch);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

let syncNowCallback  = null;
let stopCallback     = null;

function createServer() {
  const server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];

    // CORS para desarrollo local
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    // ── GET /  →  Dashboard HTML
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      const htmlPath = path.join(__dirname, "dashboard", "index.html");
      try {
        const html = fs.readFileSync(htmlPath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      } catch {
        res.writeHead(500);
        return res.end("Dashboard no encontrado");
      }
    }

    // ── GET /api/status
    if (req.method === "GET" && url === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        running:     serverState.running,
        totalSynced: serverState.totalSynced,
        cycles:      serverState.cycles,
        errors:      serverState.errors,
        lastSync:    serverState.lastSync,
        chatName:    serverState.chatName,
        nextSyncIn:  serverState.nextSyncIn
      }));
    }

    // ── GET /api/logs
    if (req.method === "GET" && url === "/api/logs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ logs: serverState.logs }));
    }

    // ── POST /api/sync-now
    if (req.method === "POST" && url === "/api/sync-now") {
      if (syncNowCallback) syncNowCallback();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    }

    // ── POST /api/stop
    if (req.method === "POST" && url === "/api/stop") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      if (stopCallback) stopCallback();
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[Dashboard] Disponible en http://localhost:${PORT}`);
  });

  return server;
}

module.exports = { createServer, setState, addLog, serverState, setCallbacks };

function setCallbacks({ onSyncNow, onStop }) {
  syncNowCallback = onSyncNow;
  stopCallback    = onStop;
}