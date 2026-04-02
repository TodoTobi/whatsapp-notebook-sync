const puppeteer = require("puppeteer");

async function iniciar() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./session",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });

  const page = await browser.newPage();

  await page.goto("https://web.whatsapp.com", {
    waitUntil: "networkidle2"
  });

  console.log("Esperando login o sesión existente...");

  // ✅ Espera más robusta (varios posibles selectores)
  await page.waitForFunction(() => {
    return document.querySelector("div[title='Buscar o empezar un chat']") ||
           document.querySelector("div[contenteditable='true']");
  }, { timeout: 0 });

  console.log("WhatsApp listo");

  return { browser, page };
}

// 🔍 abrir chat por nombre (versión robusta)
async function abrirChat(page, nombre) {
  console.log("Buscando chat...");

  // Esperar buscador
  const searchBox = await page.waitForSelector(
    "div[title='Buscar o empezar un chat']",
    { timeout: 0 }
  );

  // Limpiar input (importante)
  await searchBox.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");

  // Escribir nombre
  await page.keyboard.type(nombre, { delay: 100 });

  // Esperar resultados
  await page.waitForTimeout(2000);

  // Seleccionar primer chat
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  // Esperar que el chat cargue
  await page.waitForSelector("div[role='textbox']", { timeout: 0 });

  console.log("Chat abierto");
}

// 📥 obtener mensajes (mejorado)
async function obtenerMensajes(page) {
  return await page.evaluate(async () => {

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 🔥 Forzar scroll hacia arriba para cargar mensajes
    const chat = document.querySelector("div[role='application']");

    if (chat) {
      for (let i = 0; i < 5; i++) {
        chat.scrollTop = 0;
        await sleep(500);
      }
    }

    await sleep(2000); // esperar render

    const mensajes = [];

    const nodes = document.querySelectorAll(
      "div.message-in span.selectable-text, div.message-out span.selectable-text"
    );

    nodes.forEach(n => {
      const texto = n.innerText;
      if (texto && texto.trim() !== "") {
        mensajes.push(texto.trim());
      }
    });

    return mensajes;
  });
}

module.exports = {
  iniciar,
  abrirChat,
  obtenerMensajes
};