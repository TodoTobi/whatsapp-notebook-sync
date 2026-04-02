const fs = require("fs");

const FILE = "state.json";

/**
 * Lee el estado actual desde disco.
 * Si el archivo no existe o está corrupto, devuelve un estado inicial limpio.
 */
function getState() {
  try {
    if (!fs.existsSync(FILE)) {
      return { lastMessage: null };
    }

    const contenido = fs.readFileSync(FILE, "utf-8");
    const estado = JSON.parse(contenido);

    // Validación básica de la estructura
    if (typeof estado !== "object" || estado === null) {
      console.warn("[State] state.json con formato inválido. Reiniciando estado.");
      return { lastMessage: null };
    }

    return estado;
  } catch (err) {
    console.error("[State] Error leyendo state.json:", err.message);
    return { lastMessage: null };
  }
}

/**
 * Guarda el último mensaje procesado en disco.
 * Usa escritura atómica (temp file + rename) para evitar corrupción.
 *
 * @param {string} lastMessage - Texto del último mensaje procesado
 */
function setState(lastMessage) {
  const TEMP = FILE + ".tmp";

  try {
    const contenido = JSON.stringify({ lastMessage }, null, 2);
    fs.writeFileSync(TEMP, contenido, "utf-8");
    fs.renameSync(TEMP, FILE);
  } catch (err) {
    console.error("[State] Error guardando state.json:", err.message);

    // Intentar limpiar el archivo temporal si quedó colgado
    try {
      if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);
    } catch (_) {}
  }
}

/**
 * Resetea el estado completamente (útil para debug o inicio limpio).
 */
function resetState() {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ lastMessage: null }, null, 2), "utf-8");
    console.log("[State] Estado reseteado.");
  } catch (err) {
    console.error("[State] Error reseteando estado:", err.message);
  }
}

module.exports = { getState, setState, resetState };