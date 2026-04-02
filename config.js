module.exports = {
  // Tu nombre exacto como aparece en WhatsApp (el chat "Tú mismo" o tu nombre)
  CHAT_NAME: "Tobias",

  // ID del Google Doc donde se guardan los mensajes
  // Lo encontrás en la URL: docs.google.com/document/d/<DOC_ID>/edit
  DOC_ID: "14WMyZ5b4H9u88WKZSJ4VU3eAflFFmTJU0_OxVknJ2UA",

  // Intervalo de polling en milisegundos (60000 = 1 minuto)
  INTERVAL: 60000,

  // Máximo de reintentos para llamadas a la API de Google
  MAX_RETRIES: 3,

  // Delay base para backoff exponencial en reintentos (ms)
  RETRY_BASE_DELAY: 1000,

  // Cantidad de mensajes a procesar por ciclo (evita writes gigantes)
  MAX_MESSAGES_PER_BATCH: 50
};