const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/documents"];
const TOKEN_PATH = "token.json";

function authorize() {
  let credentials;

  try {
    const content = fs.readFileSync("credentials.json", "utf-8");
    credentials = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `No se pudo leer credentials.json: ${err.message}\n` +
      `Asegurate de haber descargado las credenciales OAuth desde Google Cloud Console.`
    );
  }

  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      oAuth2Client.setCredentials(token);
      console.log("Token existente cargado correctamente.");
      return Promise.resolve(oAuth2Client);
    } catch (err) {
      console.warn("Token inválido o corrupto, solicitando nuevo token...");
      fs.unlinkSync(TOKEN_PATH);
    }
  }

  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  });

  console.log("\nAutorizá esta app visitando el siguiente link:");
  console.log(authUrl);
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    rl.question("Pegá el código de autorización acá: ", (code) => {
      rl.close();

      oAuth2Client.getToken(code.trim(), (err, token) => {
        if (err) {
          return reject(
            new Error(`Error obteniendo token de Google: ${err.message}`)
          );
        }

        oAuth2Client.setCredentials(token);

        try {
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), "utf-8");
          console.log("Token guardado en", TOKEN_PATH);
        } catch (writeErr) {
          console.warn("No se pudo guardar el token:", writeErr.message);
        }

        resolve(oAuth2Client);
      });
    });
  });
}

module.exports = { authorize };