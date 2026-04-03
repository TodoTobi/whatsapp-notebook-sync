const puppeteer = require("puppeteer");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function iniciar() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./session",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "font", "media"].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2", timeout: 60000 });

  console.log("Esperando sesión de WhatsApp...");

  // Confirmado por debug: #pane-side y div[aria-label='Lista de chats'] existen
  await page.waitForFunction(
    () => document.querySelector("#pane-side") || document.querySelector("div[aria-label='Lista de chats']"),
    { timeout: 0 }
  );

  await sleep(2000);
  console.log("WhatsApp Web listo.");
  return { browser, page };
}

async function abrirChat(page, nombre) {
  console.log(`Buscando chat: "${nombre}"...`);

  // Confirmado por debug: INPUT con data-tab='3' y placeholder 'Buscar un chat...'
  const buscador = await page.waitForSelector("input[data-tab='3']", { timeout: 15000 });

  await buscador.click({ clickCount: 3 });
  await sleep(200);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await sleep(300);

  await buscador.type(nombre, { delay: 80 });
  await sleep(2500);

  // El debug mostró que [role='listitem'] existe — clickear el primero
  const clickOk = await page.evaluate((nombreBuscado) => {
    const items = Array.from(document.querySelectorAll("[role='listitem']"));

    // Preferir el que contenga el nombre
    const match = items.find(
      (el) => el.innerText?.toLowerCase().includes(nombreBuscado.toLowerCase())
    );

    if (match) { match.click(); return "match"; }
    if (items[0]) { items[0].click(); return "primero"; }
    return null;
  }, nombre);

  if (!clickOk) {
    console.warn("[Scraper] Sin resultados clickeables, usando teclado...");
    await page.keyboard.press("ArrowDown");
    await sleep(300);
    await page.keyboard.press("Enter");
  } else {
    console.log(`[Scraper] Chat abierto por click (${clickOk}).`);
  }

  await sleep(2000);

  // Confirmar que #main cargó
  await page.waitForSelector("#main", { timeout: 10000 }).catch(() => {
    console.warn("[Scraper] #main no apareció, continuando igual...");
  });

  console.log("Chat listo.");
}

/**
 * Hace scroll hacia arriba repetidamente para forzar que WA
 * renderice mensajes históricos en el DOM virtualizado.
 *
 * WA carga ~20 mensajes por viewport. Cada scroll hacia arriba
 * descarta los de abajo y carga los anteriores.
 * Para capturar todo el historial visible hay que scrollear,
 * leer, y acumular — no se pueden tener todos al mismo tiempo.
 *
 * @param {number} rondas - Cuántas veces scrollear (cada ronda ≈ 20 mensajes más)
 */
async function cargarHistorial(page, rondas = 10) {
  console.log(`[Scraper] Cargando historial (${rondas} rondas de scroll)...`);

  const totalAntes = await page.evaluate(() =>
    document.querySelectorAll("div[class*='copyable-text']").length
  );

  for (let i = 0; i < rondas; i++) {
    await page.evaluate(() => {
      // Scrollear el contenedor de mensajes hacia arriba
      const contenedor =
        document.querySelector("#main div[tabindex='-1']") ||
        document.querySelector("#main div[role='application']") ||
        document.querySelector("#main");

      if (contenedor) contenedor.scrollTop = 0;
    });
    await sleep(800);
  }

  // Volver al final para ver los más recientes
  await page.evaluate(() => {
    const contenedor =
      document.querySelector("#main div[tabindex='-1']") ||
      document.querySelector("#main div[role='application']") ||
      document.querySelector("#main");
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
  });

  await sleep(1000);

  const totalDespues = await page.evaluate(() =>
    document.querySelectorAll("div[class*='copyable-text']").length
  );

  console.log(`[Scraper] Mensajes en DOM: ${totalAntes} → ${totalDespues}`);
}

/**
 * Extrae todos los mensajes de texto visibles en el DOM.
 *
 * Selectores confirmados por debug:
 *   - div[class*='copyable-text']  → count: 19, tiene el texto real
 *   - #main span[dir='ltr']        → count: 19, también tiene texto
 *
 * Usamos copyable-text como principal porque es el más específico
 * al contenido de mensajes de texto.
 */
async function obtenerMensajes(page) {
  const mensajes = await page.evaluate(() => {
    const resultado = [];

    // Selector confirmado: div[class*='copyable-text']
    // Cada uno representa un mensaje con su texto completo
    const nodos = document.querySelectorAll("div[class*='copyable-text']");

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

/**
 * Versión de obtenerMensajes que hace scroll acumulando todo el historial.
 * Úsala solo en la lectura inicial — es lenta pero completa.
 */
async function obtenerTodoElHistorial(page, rondas = 15) {
  const acumulado = new Set();
  let sinCambiosConsecutivos = 0;

  console.log("[Scraper] Recolectando historial completo...");

  // Ir al principio primero
  for (let i = 0; i < rondas; i++) {
    await page.evaluate(() => {
      const c =
        document.querySelector("#main div[tabindex='-1']") ||
        document.querySelector("#main");
      if (c) c.scrollTop = 0;
    });
    await sleep(700);

    const lote = await obtenerMensajes(page);
    const antesCount = acumulado.size;
    lote.forEach((m) => acumulado.add(m));

    if (acumulado.size === antesCount) {
      sinCambiosConsecutivos++;
      if (sinCambiosConsecutivos >= 3) {
        console.log("[Scraper] Sin mensajes nuevos en 3 rondas, deteniendo scroll.");
        break;
      }
    } else {
      sinCambiosConsecutivos = 0;
      console.log(`[Scraper] Ronda ${i + 1}: ${acumulado.size} mensajes únicos acumulados.`);
    }
  }

  // Volver al final
  await page.evaluate(() => {
    const c = document.querySelector("#main div[tabindex='-1']") || document.querySelector("#main");
    if (c) c.scrollTop = c.scrollHeight;
  });
  await sleep(1000);

  return Array.from(acumulado);
}

module.exports = { iniciar, abrirChat, obtenerMensajes, obtenerTodoElHistorial };