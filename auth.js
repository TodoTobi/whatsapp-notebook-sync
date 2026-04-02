const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/documents"];
const TOKEN_PATH = "token.json";

function authorize() {
  const content = fs.readFileSync("credentials.json");
  const credentials = JSON.parse(content);

  const { client_secret, client_id, redirect_uris } =
    credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Ver si ya hay token
  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  }

  return getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES
  });

  console.log("Autoriza esta app en este link:");
  console.log(authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question("Pegá el código acá: ", (code) => {
      rl.close();

      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error obteniendo token", err);

        oAuth2Client.setCredentials(token);

        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log("Token guardado");

        resolve(oAuth2Client);
      });
    });
  });
}

module.exports = { authorize };