const CATEGORIAS = {
  "#idea": "IDEAS",
  "#estudio": "ESTUDIO",
  "#reflexion": "REFLEXION",
  "#reflexión": "REFLEXION",
  "#codigo": "CODIGO",
  "#código": "CODIGO"
};

function clasificar(msg) {
  const lower = msg.toLowerCase().trimStart();

  for (const [tag, categoria] of Object.entries(CATEGORIAS)) {
    if (lower.startsWith(tag)) return categoria;
  }

  return "OTROS";
}

function formatear(msg) {
  const categoria = clasificar(msg);
  const fecha = new Date().toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  return `[${categoria}] (${fecha})\n${msg.trim()}\n\n`;
}

module.exports = { clasificar, formatear };