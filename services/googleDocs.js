const { google } = require("googleapis");
const config = require("../config");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reintenta una función async con backoff exponencial.
 *
 * @param {Function} fn - Función async a ejecutar
 * @param {number} maxRetries - Máximo de reintentos
 * @param {number} baseDelay - Delay base en ms (se duplica en cada reintento)
 */
async function conReintentos(fn, maxRetries = config.MAX_RETRIES, baseDelay = config.RETRY_BASE_DELAY) {
  let ultimoError;

  for (let intento = 1; intento <= maxRetries; intento++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;

      const esRateLimitOrNetwork =
        err.code === 429 ||
        err.code === 503 ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT");

      if (!esRateLimitOrNetwork && intento === 1) {
        // Error que no es de red/rate-limit: reintentar igual pero avisar
        console.warn(`[Docs] Error en intento ${intento}:`, err.message);
      }

      if (intento < maxRetries) {
        const delay = baseDelay * Math.pow(2, intento - 1);
        console.warn(`[Docs] Reintentando en ${delay}ms... (intento ${intento}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `[Docs] Falló después de ${maxRetries} intentos. Último error: ${ultimoError?.message}`
  );
}

/**
 * Agrega texto al final de un Google Doc.
 * Usa reintentos automáticos en caso de errores de red o rate limiting.
 *
 * @param {object} auth - Cliente OAuth2 autenticado
 * @param {string} docId - ID del documento de Google Docs
 * @param {string} texto - Texto a agregar al final del documento
 */
async function appendToDoc(auth, docId, texto) {
  if (!texto || texto.trim() === "") {
    console.warn("[Docs] Texto vacío, no se escribe nada.");
    return;
  }

  await conReintentos(async () => {
    const docs = google.docs({ version: "v1", auth });

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              endOfSegmentLocation: {},
              text: texto
            }
          }
        ]
      }
    });

    console.log(`[Docs] Escrito correctamente (${texto.length} caracteres).`);
  });
}

module.exports = { appendToDoc };