const { iniciar, abrirChat, obtenerMensajes } = require("./core/scraper");
const { filtrarNuevos, limpiar } = require("./core/parser");
const { formatear } = require("./core/classifier");
const { getState, setState } = require("./utils/stateManager");
const { appendToDoc } = require("./services/googleDocs");
const { authorize } = require("./auth");
const config = require("./config");

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let browser = null;
let intervalId = null;

async function shutdown(señal) {
  console.log(`\n[Sistema] Señal ${señal} recibida. Cerrando...`);
  if (intervalId) clearInterval(intervalId);
  if (browser) {
    try {
      await browser.close();
      console.log("[Sistema] Browser cerrado correctamente.");
    } catch (err) {
      console.warn("[Sistema] Error cerrando browser:", err.message);
    }
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log("=== WhatsApp → Google Docs Sync ===\n");

  // 1. Autenticación con Google
  let auth;
  try {
    auth = await authorize();
  } catch (err) {
    console.error("[Auth] Error fatal:", err.message);
    process.exit(1);
  }

  // 2. Iniciar WhatsApp Web
  let page;
  try {
    const resultado = await iniciar();
    browser = resultado.browser;
    page = resultado.page;
  } catch (err) {
    console.error("[Scraper] Error iniciando browser:", err.message);
    process.exit(1);
  }

  // 3. Abrir el chat objetivo
  try {
    await abrirChat(page, config.CHAT_NAME);
  } catch (err) {
    console.error("[Scraper] Error abriendo chat:", err.message);
    await browser.close();
    process.exit(1);
  }

  // 4. Esperar que los mensajes carguen
  console.log("Esperando que carguen los mensajes...");
  await sleep(3000);

  // 5. Lectura inicial
  console.log("Leyendo mensajes existentes...");
  const mensajesIniciales = await obtenerMensajes(page);
  console.log(`[Init] ${mensajesIniciales.length} mensajes visibles en el DOM.`);

  const estado = getState();
  const esNuevaEjecucion = !estado.lastMessage;

  if (mensajesIniciales.length === 0) {
    console.log("[Init] Sin mensajes visibles. Esperando mensajes futuros...");
  } else if (esNuevaEjecucion) {
    // Primera ejecución: subir todo el historial visible
    console.log(`[Init] Primera ejecución. Subiendo ${mensajesIniciales.length} mensajes al Doc...`);

    const mensajesLimpios = mensajesIniciales.map(limpiar).filter((m) => m.length > 0);
    const LOTE = config.MAX_MESSAGES_PER_BATCH;

    for (let i = 0; i < mensajesLimpios.length; i += LOTE) {
      const lote = mensajesLimpios.slice(i, i + LOTE);
      const texto = lote.map(formatear).join("");
      await appendToDoc(auth, config.DOC_ID, texto);
      console.log(`[Init] Lote ${Math.floor(i / LOTE) + 1} subido (${lote.length} mensajes).`);
    }

    setState(mensajesLimpios[mensajesLimpios.length - 1]);
    console.log("[Init] Historial inicial subido. De ahora en más solo se sincronizan los nuevos.");
  } else {
    // Ejecuciones siguientes: solo los mensajes perdidos desde la última vez
    const nuevos = filtrarNuevos(mensajesIniciales, estado.lastMessage)
      .map(limpiar)
      .filter((m) => m.length > 0);

    if (nuevos.length > 0) {
      console.log(`[Init] ${nuevos.length} mensajes nuevos desde la última ejecución. Sincronizando...`);
      const texto = nuevos.map(formatear).join("");
      await appendToDoc(auth, config.DOC_ID, texto);
      setState(nuevos[nuevos.length - 1]);
      console.log("[Init] Mensajes perdidos sincronizados.");
    } else {
      console.log("[Init] Sin mensajes nuevos desde la última ejecución.");
    }
  }

  // 6. Loop de polling
  console.log(`\nSincronización activa. Revisando cada ${config.INTERVAL / 1000}s...\n`);

  intervalId = setInterval(async () => {
    try {
      const mensajes = await obtenerMensajes(page);
      const estadoActual = getState();

      const nuevos = filtrarNuevos(mensajes, estadoActual.lastMessage)
        .map(limpiar)
        .filter((m) => m.length > 0)
        .slice(0, config.MAX_MESSAGES_PER_BATCH);

      if (nuevos.length === 0) {
        console.log(`[Sync] Sin mensajes nuevos. (${new Date().toLocaleTimeString()})`);
        return;
      }

      console.log(`[Sync] ${nuevos.length} mensaje(s) nuevo(s). Sincronizando...`);
      const texto = nuevos.map(formatear).join("");
      await appendToDoc(auth, config.DOC_ID, texto);
      setState(nuevos[nuevos.length - 1]);
      console.log(`[Sync] Listo. (${new Date().toLocaleTimeString()})`);
    } catch (err) {
      console.error(`[Sync] Error en ciclo:`, err.message);
    }
  }, config.INTERVAL);
})();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}