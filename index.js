const { iniciar, abrirChat, obtenerMensajes, obtenerTodoElHistorial } = require("./core/scraper");
const { filtrarNuevos, limpiar } = require("./core/parser");
const { formatear } = require("./core/classifier");
const { getState, setState } = require("./utils/stateManager");
const { appendToDoc } = require("./services/googleDocs");
const { authorize } = require("./auth");
const { createServer, setState: setServerState, addLog, setCallbacks } = require("./server");
const { notify } = require("./notifier");
const config = require("./config");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Estado global ────────────────────────────────────────────────────────────

let browser     = null;
let intervalId  = null;
let page        = null;
let auth        = null;
let forceSyncPending = false;
let cycleCount  = 0;
let errorCount  = 0;
let totalSynced = 0;
let nextSyncIn  = config.INTERVAL / 1000;

// ─── Helpers de log ───────────────────────────────────────────────────────────

function log(type, msg) {
  const prefix = { sync: "[Sync]", info: "[Info]", warn: "[Warn]", error: "[Error]" };
  console.log(`${prefix[type] || "[Log]"} ${msg}`);
  addLog(type, msg);
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(señal) {
  log("warn", `Señal ${señal} recibida. Cerrando...`);
  setServerState({ running: false });

  if (intervalId) clearInterval(intervalId);
  if (browser) {
    try { await browser.close(); log("info", "Browser cerrado."); }
    catch (e) { log("warn", "Error cerrando browser: " + e.message); }
  }
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─── Countdown del próximo sync ───────────────────────────────────────────────

function startCountdown() {
  nextSyncIn = config.INTERVAL / 1000;
  const tick = setInterval(() => {
    nextSyncIn = Math.max(0, nextSyncIn - 1);
    setServerState({ nextSyncIn });
  }, 1000);
  return tick;
}

// ─── Lógica de sync ───────────────────────────────────────────────────────────

async function runSync() {
  try {
    const mensajes = await obtenerMensajes(page);
    const estado   = getState();

    const nuevos = filtrarNuevos(mensajes, estado.lastMessage)
      .map(limpiar)
      .filter((m) => m.length > 0)
      .slice(0, config.MAX_MESSAGES_PER_BATCH);

    cycleCount++;
    setServerState({ cycles: cycleCount });

    if (nuevos.length === 0) {
      log("info", `Sin mensajes nuevos. (${new Date().toLocaleTimeString()})`);
      return;
    }

    log("sync", `${nuevos.length} mensaje(s) nuevo(s). Sincronizando...`);
    await appendToDoc(auth, config.DOC_ID, nuevos.map(formatear).join(""));

    setState(nuevos[nuevos.length - 1]);
    totalSynced += nuevos.length;
    setServerState({ totalSynced, lastSync: new Date().toISOString() });

    log("sync", `Listo. ${totalSynced} mensajes sincronizados en total.`);

    // Notificación de escritorio
    notify(
      "WA Sync",
      `${nuevos.length} mensaje${nuevos.length > 1 ? "s" : ""} nuevo${nuevos.length > 1 ? "s" : ""} sincronizado${nuevos.length > 1 ? "s" : ""} al Doc.`,
      "info"
    );

  } catch (err) {
    errorCount++;
    setServerState({ errors: errorCount });
    log("error", `Error en ciclo: ${err.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== WhatsApp → Google Docs Sync ===\n");

  // 1. Iniciar dashboard
  createServer();

  // 2. Registrar callbacks del dashboard
  setCallbacks({
    onSyncNow: () => { forceSyncPending = true; },
    onStop:    () => shutdown("dashboard")
  });

  // 3. Auth Google
  try {
    auth = await authorize();
    log("info", "Autenticación con Google OK.");
  } catch (err) {
    log("error", "Auth fatal: " + err.message);
    process.exit(1);
  }

  // 4. Iniciar browser
  try {
    const r = await iniciar();
    browser = r.browser;
    page    = r.page;
    log("info", "Browser iniciado.");
  } catch (err) {
    log("error", "Error iniciando browser: " + err.message);
    process.exit(1);
  }

  // 5. Abrir chat
  try {
    await abrirChat(page, config.CHAT_NAME);
    setServerState({ chatName: config.CHAT_NAME, running: true });
    log("info", `Chat "${config.CHAT_NAME}" abierto.`);
  } catch (err) {
    log("error", "Error abriendo chat: " + err.message);
    await browser.close();
    process.exit(1);
  }

  await sleep(3000);

  // 6. Lectura inicial
  const estado = getState();
  const esNuevaEjecucion = !estado.lastMessage;

  if (esNuevaEjecucion) {
    log("info", "Primera ejecución — recolectando historial completo (puede tardar ~2 min)...");
    notify("WA Sync", "Recolectando historial completo. Puede tardar un par de minutos.", "info");

    const historial = await obtenerTodoElHistorial(page, 20);
    const limpios   = historial.map(limpiar).filter((m) => m.length > 0);

    log("info", `${limpios.length} mensajes únicos recolectados.`);

    if (limpios.length > 0) {
      const LOTE = config.MAX_MESSAGES_PER_BATCH;
      for (let i = 0; i < limpios.length; i += LOTE) {
        const lote  = limpios.slice(i, i + LOTE);
        await appendToDoc(auth, config.DOC_ID, lote.map(formatear).join(""));
        log("sync", `Lote ${Math.floor(i/LOTE)+1}/${Math.ceil(limpios.length/LOTE)} subido.`);
      }
      setState(limpios[limpios.length - 1]);
      totalSynced = limpios.length;
      setServerState({ totalSynced, lastSync: new Date().toISOString() });
      log("sync", "Historial completo subido al Doc.");
      notify("WA Sync", `Historial subido: ${limpios.length} mensajes en Google Docs.`, "info");
    }
  } else {
    log("info", "Sesión existente. Verificando mensajes perdidos...");
    const mensajes = await obtenerMensajes(page);
    const nuevos   = filtrarNuevos(mensajes, estado.lastMessage).map(limpiar).filter((m) => m.length > 0);
    if (nuevos.length > 0) {
      await appendToDoc(auth, config.DOC_ID, nuevos.map(formatear).join(""));
      setState(nuevos[nuevos.length - 1]);
      totalSynced = nuevos.length;
      setServerState({ totalSynced, lastSync: new Date().toISOString() });
      log("sync", `${nuevos.length} mensajes perdidos sincronizados.`);
    } else {
      log("info", "Sin mensajes perdidos.");
    }
  }

  // 7. Loop de polling con countdown y force-sync
  log("info", `Sincronización activa. Revisando cada ${config.INTERVAL / 1000}s.`);
  log("info", `Dashboard disponible en http://localhost:3030`);

  let countdownTick = startCountdown();

  intervalId = setInterval(async () => {
    clearInterval(countdownTick);
    await runSync();
    countdownTick = startCountdown();
  }, config.INTERVAL);

  // Chequear force-sync cada segundo
  setInterval(async () => {
    if (!forceSyncPending) return;
    forceSyncPending = false;
    log("info", "Sync manual solicitado desde el dashboard.");
    clearInterval(countdownTick);
    await runSync();
    countdownTick = startCountdown();
  }, 1000);

})();