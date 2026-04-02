function filtrarNuevos(mensajes, last) {
  if (!last) return mensajes;

  const index = mensajes.indexOf(last);
  if (index === -1) return mensajes;

  return mensajes.slice(index + 1);
}

module.exports = { filtrarNuevos };