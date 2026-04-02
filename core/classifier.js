function clasificar(msg) {
  if (msg.startsWith("#idea")) return "IDEAS";
  if (msg.startsWith("#estudio")) return "ESTUDIO";
  if (msg.startsWith("#reflexion")) return "REFLEXION";
  if (msg.startsWith("#codigo")) return "CODIGO";
  return "OTROS";
}

function formatear(msg) {
  const categoria = clasificar(msg);
  const fecha = new Date().toLocaleString();

  return `[${categoria}] (${fecha})\n${msg}\n\n`;
}

module.exports = { formatear };