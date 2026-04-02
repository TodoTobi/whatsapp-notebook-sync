/**
 * debug.js v2 — Abre el chat y diagnostica los selectores de mensajes.
 * Corré: node debug.js
 */

const puppeteer = require("puppeteer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./session",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2", timeout: 60000 });

  console.log("Esperando que WA cargue (10s)...");
  await sleep(10000);

  // ── PASO 1: Ver qué hay en el buscador ──────────────────────────────────
  console.log("\n=== PASO 1: BUSCADOR ===");
  const infoBuscador = await page.evaluate(() => {
    const candidatos = Array.from(document.querySelectorAll("input, [contenteditable='true'], [role='textbox']"));
    return candidatos.map(el => ({
      tag: el.tagName,
      type: el.getAttribute("type") || "",
      role: el.getAttribute("role") || "",
      dataTab: el.getAttribute("data-tab") || "",
      placeholder: el.getAttribute("placeholder") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
      title: el.getAttribute("title") || "",
      id: el.id || "",
      class: el.className?.toString().slice(0, 80) || ""
    }));
  });
  console.log(JSON.stringify(infoBuscador, null, 2));

  // ── PASO 2: Intentar abrir el chat escribiendo directo ───────────────────
  console.log("\n=== PASO 2: ABRIENDO CHAT ===");

  // Probar input[data-tab='3'] y también por placeholder/aria
  let buscador = null;
  const selectorsBuscador = [
    "input[data-tab='3']",
    "div[data-tab='3'][contenteditable]",
    "div[role='textbox'][data-tab='3']",
    "input[type='text']",
    "input[aria-label]",
    "#side input"
  ];

  for (const sel of selectorsBuscador) {
    try {
      buscador = await page.waitForSelector(sel, { timeout: 3000 });
      if (buscador) { console.log("Buscador encontrado con:", sel); break; }
    } catch (_) {}
  }

  if (!buscador) {
    console.log("ERROR: No encontré el buscador. Revisá el PASO 1 y buscá el elemento correcto.");
    await sleep(30000);
    await browser.close();
    return;
  }

  // Limpiar y escribir en el buscador
  await buscador.click({ clickCount: 3 });
  await sleep(300);
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Backspace");
  await sleep(300);
  await buscador.type("Tobias", { delay: 100 });
  await sleep(3000);

  // ── PASO 3: Ver qué resultados aparecieron ───────────────────────────────
  console.log("\n=== PASO 3: RESULTADOS DE BÚSQUEDA ===");
  const resultados = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(
      "[role='listitem'], [role='option'], [data-testid*='cell'], [data-testid*='list-item']"
    ));
    return items.slice(0, 5).map(el => ({
      role: el.getAttribute("role") || "",
      testid: el.getAttribute("data-testid") || "",
      texto: el.innerText?.trim().slice(0, 60) || "",
      tag: el.tagName,
      class: el.className?.toString().slice(0, 60) || ""
    }));
  });
  console.log(JSON.stringify(resultados, null, 2));

  // Hacer click en el primer resultado
  const clickOk = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[role='listitem']"));
    if (items[0]) { items[0].click(); return true; }
    return false;
  });

  if (!clickOk) {
    await page.keyboard.press("ArrowDown");
    await sleep(300);
    await page.keyboard.press("Enter");
  }

  await sleep(3000);
  console.log("Chat abierto (o intentado).");

  // ── PASO 4: Diagnosticar mensajes con el chat abierto ────────────────────
  console.log("\n=== PASO 4: SELECTORES DE MENSAJES (con chat abierto) ===");
  const infoMensajes = await page.evaluate(() => {
    const SELECTORES = [
      "div.message-in span.selectable-text",
      "div.message-out span.selectable-text",
      "#main span.selectable-text",
      "#main span[class*='selectable']",
      "#main div[class*='message']",
      "#main [data-testid*='msg']",
      "#main [data-testid='msg-container']",
      "div[data-testid='conv-recommended-msg-bubble']",
      "#main div[tabindex='-1'] span",
      "div[class*='copyable-text']",
      "span[class*='copyable-text']",
      "#main span[dir='ltr']",
      "#main span[dir='rtl']",
      "#main p",
    ];

    const resultado = {};
    for (const sel of SELECTORES) {
      const nodos = document.querySelectorAll(sel);
      resultado[sel] = {
        count: nodos.length,
        ejemplo: nodos[0]?.innerText?.trim().slice(0, 50) || ""
      };
    }

    // También ver qué hay dentro de #main
    const main = document.querySelector("#main");
    resultado["__main_existe"] = !!main;
    resultado["__main_children"] = main ? main.children.length : 0;

    // data-testids dentro de #main
    const testids = new Set();
    main?.querySelectorAll("[data-testid]").forEach(el => testids.add(el.getAttribute("data-testid")));
    resultado["__data_testids_en_main"] = [...testids].slice(0, 30);

    // clases que contienen "message" o "msg"
    const clasesMsg = new Set();
    main?.querySelectorAll("*").forEach(el => {
      el.classList?.forEach(c => {
        if (c.toLowerCase().includes("msg") || c.toLowerCase().includes("message")) {
          clasesMsg.add(c);
        }
      });
    });
    resultado["__clases_con_msg"] = [...clasesMsg].slice(0, 20);

    return resultado;
  });

  console.log(JSON.stringify(infoMensajes, null, 2));

  console.log("\n=== FIN — Podés cerrar el browser en 30s ===");
  await sleep(30000);
  await browser.close();
})();