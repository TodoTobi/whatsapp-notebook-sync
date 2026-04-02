const puppeteer = require("puppeteer");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Inicia el browser y navega a WhatsApp Web.
 * Reutiliza la sesión guardada en ./session si existe.
 */
async function iniciar() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./session",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  const page = await browser.newPage();

  // Bloquear recursos innecesarios
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "font", "media"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto("https://web.whatsapp.com", {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  console.log("Esperando sesión de WhatsApp (escaneá el QR si es necesario)...");

  // El diagnóstico confirmó que estos son los selectores reales presentes:
  // - #pane-side  →  panel lateral de chats
  // - div[aria-label='Lista de chats']  →  contenedor de la lista
  // Esperamos cualquiera de los dos para confirmar que WA cargó
  await page.waitForFunction(
    () =>
      document.querySelector("#pane-side") ||
      document.querySelector("div[aria-label='Lista de chats']"),
    { timeout: 0 }
  );

  await sleep(1500);
  console.log("WhatsApp Web listo.");

  return { browser, page };
}

/**
 * Abre un chat buscando por nombre.
 *
 * El diagnóstico reveló que el buscador es:
 *   <INPUT data-tab="3" role="textbox">
 * No un div, sino un input nativo.
 */
async function abrirChat(page, nombre) {
  console.log(`Buscando chat: "${nombre}"...`);

  // Selector exacto confirmado por debug: INPUT con data-tab="3"
  const buscador = await page.waitForSelector("input[data-tab='3']", {
    timeout: 15000
  });

  // Limpiar y escribir
  await buscador.click({ clickCount: 3 });
  await sleep(200);
  await buscador.press("Backspace");
  await sleep(200);

  await buscador.type(nombre, { delay: 80 });
  console.log(`Buscando "${nombre}"...`);

  // Esperar que aparezcan resultados
  await sleep(2500);

  // Hacer click en el primer resultado que contenga el nombre buscado
  const clickResultado = await page.evaluate((nombreBuscado) => {
    // Con la nueva UI de WA los resultados están en #pane-side como list items
    const items = Array.from(document.querySelectorAll(
      "#pane-side div[role='listitem'], " +
      "div[aria-label='Lista de chats'] div[role='listitem']"
    ));

    // Buscar el que contenga el nombre en su texto
    const match = items.find(
      (el) => el.innerText && el.innerText.toLowerCase().includes(nombreBuscado.toLowerCase())
    );

    if (match) {
      match.click();
      return true;
    }

    // Fallback: clickear el primer listitem disponible
    if (items.length > 0) {
      items[0].click();
      return "primer-resultado";
    }

    return false;
  }, nombre);

  if (clickResultado === false) {
    // Último fallback: teclado
    console.warn("[Scraper] No encontré resultado clickeable, usando teclado...");
    await page.keyboard.press("ArrowDown");
    await sleep(300);
    await page.keyboard.press("Enter");
  } else if (clickResultado === "primer-resultado") {
    console.warn("[Scraper] No encontré el nombre exacto, abrí el primer resultado disponible.");
  }

  await sleep(2000);

  // Confirmar que el chat se abrió: debe aparecer el área de mensajes
  try {
    await page.waitForSelector("#main", { timeout: 10000 });
    console.log("Chat abierto correctamente.");
  } catch (_) {
    console.warn("[Scraper] No confirmé apertura del chat, continuando igual...");
  }
}

/**
 * Fuerza scroll hacia arriba para cargar mensajes históricos.
 * WA virtualiza el DOM — sin scroll solo hay ~20 mensajes visibles.
 */
async function forzarCargaMensajes(page, pasadas = 6) {
  await page.evaluate(async (n) => {
    // Buscar el contenedor scrolleable dentro de #main
    const selectores = [
      "#main div[tabindex='-1']",
      "#main div[role='application']",
      "#main div[class*='copyable-area']",
      "#main"
    ];

    let chat = null;
    for (const sel of selectores) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) {
        chat = el;
        break;
      }
    }

    if (!chat) return;

    for (let i = 0; i < n; i++) {
      chat.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 600));
    }

    // Volver al final
    chat.scrollTop = chat.scrollHeight;
    await new Promise((r) => setTimeout(r, 800));
  }, pasadas);
}

/**
 * Extrae todos los mensajes de texto visibles en el chat abierto.
 *
 * Como el diagnóstico mostró que message-in/message-out no matchearon
 * (porque no había chat abierto), usamos selectores más amplios
 * dentro de #main como fallback robusto.
 */
async function obtenerMensajes(page) {
  await forzarCargaMensajes(page, 6);
  await sleep(800);

  const mensajes = await page.evaluate(() => {
    const resultado = [];

    // Intentar selectores de más específico a más general
    const SELECTORES = [
      // Selectores clásicos de WA
      "div.message-in span.selectable-text",
      "div.message-out span.selectable-text",
      // Selectores por clase parcial (más resistentes a updates)
      "#main span.selectable-text",
      // Selector muy amplio de último recurso
      "#main span[class*='selectable']"
    ];

    let nodos = [];
    for (const sel of SELECTORES) {
      nodos = Array.from(document.querySelectorAll(sel));
      if (nodos.length > 0) break;
    }

    nodos.forEach((n) => {
      const texto = n.innerText?.trim();
      if (texto && texto.length > 0) {
        resultado.push(texto);
      }
    });

    // Deduplicar consecutivos idénticos
    return resultado.filter((msg, i, arr) => i === 0 || msg !== arr[i - 1]);
  });

  return mensajes;
}

module.exports = { iniciar, abrirChat, obtenerMensajes };