const { iniciar, abrirChat, obtenerMensajes } = require("./core/scraper");
const { filtrarNuevos } = require("./core/parser");
const { formatear } = require("./core/classifier");
const { getState, setState } = require("./utils/stateManager");
const { appendToDoc } = require("./services/googleDocs");
const { authorize } = require("./auth");
const config = require("./config");

(async () => {
  const auth = await authorize();

  const { page } = await iniciar();

  await abrirChat(page, config.CHAT_NAME);

  // 🔥 ESPERAR A QUE CARGUEN MENSAJES
  console.log("Esperando carga de mensajes...");
  await page.waitForSelector("div.message-in, div.message-out", {
    timeout: 0
  });

  console.log("Chat listo para leer");

  // 🔥 PRIMERA LECTURA (IMPORTANTE)
  const mensajesIniciales = await obtenerMensajes(page);

  console.log("Mensajes iniciales:", mensajesIniciales.length);

  const estado = getState();

  // Si nunca se ejecutó antes
  if (!estado.lastMessage && mensajesIniciales.length > 0) {
    setState(mensajesIniciales[mensajesIniciales.length - 1]);
    console.log("Estado inicial guardado");
  }

  // 🔁 LOOP REAL
  setInterval(async () => {
    console.log("Buscando mensajes nuevos...");

    const mensajes = await obtenerMensajes(page);
    const estadoActual = getState();

    const nuevos = filtrarNuevos(mensajes, estadoActual.lastMessage);

    if (nuevos.length > 0) {
      console.log("Nuevos:", nuevos.length);

      const texto = nuevos.map(formatear).join("");

      await appendToDoc(auth, config.DOC_ID, texto);

      setState(nuevos[nuevos.length - 1]);
    } else {
      console.log("Sin nuevos mensajes");
    }

  }, config.INTERVAL);

})();