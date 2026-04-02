const crypto = require("crypto");

/**
 * Genera un hash corto y estable para un mensaje de texto.
 * Se usa para comparar mensajes sin depender de igualdad exacta de strings largos.
 */
function hashMsg(msg) {
  return crypto.createHash("md5").update(msg).digest("hex").slice(0, 12);
}

/**
 * Filtra los mensajes nuevos a partir del último mensaje conocido.
 *
 * Busca desde el FINAL del array para manejar correctamente el caso donde
 * el mismo texto aparece varias veces (ej: "ok", "sí", emojis repetidos).
 *
 * @param {string[]} mensajes - Array completo de mensajes del chat
 * @param {string|null} lastMessage - Texto del último mensaje procesado
 * @returns {string[]} - Solo los mensajes posteriores al último conocido
 */
function filtrarNuevos(mensajes, lastMessage) {
  if (!lastMessage || mensajes.length === 0) return mensajes;

  // Buscar desde el final para agarrar la última ocurrencia del mensaje
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i] === lastMessage) {
      return mensajes.slice(i + 1);
    }
  }

  // Si no encontramos el último mensaje conocido (puede haber scrolleado
  // fuera del DOM), devolvemos todos los mensajes visibles para no perder nada
  console.warn("[Parser] Último mensaje no encontrado en el DOM visible. Procesando todos los mensajes actuales.");
  return mensajes;
}

/**
 * Limpia y normaliza un mensaje antes de procesarlo.
 */
function limpiar(msg) {
  return msg.trim().replace(/\s+/g, " ");
}

module.exports = { filtrarNuevos, hashMsg, limpiar };