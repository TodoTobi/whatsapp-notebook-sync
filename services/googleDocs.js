const { google } = require("googleapis");

async function appendToDoc(auth, docId, texto) {
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
}

module.exports = { appendToDoc };