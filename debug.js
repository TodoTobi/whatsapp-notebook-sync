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

  // ── PASO 1: Abrir el chat ─────────────────────────────────────────────────
  console.log("\n=== ABRIENDO CHAT ===");

  const buscador = await page.waitForSelector("input[data-tab='3']", { timeout: 10000 });
  console.log("Buscador encontrado.");

  await buscador.click({ clickCount: 3 });
  await sleep(200);
  // Fix: teclas separadas, no "Control+a"
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await sleep(200);

  await buscador.type("Tobias", { delay: 100 });
  await sleep(3000);

  // Click en primer resultado
  const clickOk = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[role='listitem']"));
    if (items[0]) { items[0].click(); return items[0].innerText?.trim().slice(0, 50); }
    return null;
  });
  console.log("Click en resultado:", clickOk);

  if (!clickOk) {
    await page.keyboard.press("ArrowDown");
    await sleep(300);
    await page.keyboard.press("Enter");
  }

  await sleep(4000);
  console.log("Chat abierto. Esperando render de mensajes (5s)...");
  await sleep(5000);

  // ── PASO 2: Diagnosticar mensajes ─────────────────────────────────────────
  console.log("\n=== SELECTORES DE MENSAJES ===");
  const info = await page.evaluate(() => {
    const SELECTORES = [
      "div.message-in span.selectable-text",
      "div.message-out span.selectable-text",
      "#main span.selectable-text",
      "#main span[class*='selectable']",
      "#main div[class*='message']",
      "#main [data-testid='msg-container']",
      "div[class*='copyable-text']",
      "span[class*='copyable-text']",
      "#main span[dir='ltr']",
      "#main p",
      "#main div[tabindex='-1'] span",
    ];

    const resultado = {};
    for (const sel of SELECTORES) {
      const nodos = document.querySelectorAll(sel);
      resultado[sel] = {
        count: nodos.length,
        ejemplo: nodos[0]?.innerText?.trim().slice(0, 60) || ""
      };
    }

    const main = document.querySelector("#main");
    resultado["__main_existe"] = !!main;

    const testids = new Set();
    main?.querySelectorAll("[data-testid]").forEach(el => testids.add(el.getAttribute("data-testid")));
    resultado["__testids_en_main"] = [...testids].slice(0, 40);

    const clasesMsg = new Set();
    main?.querySelectorAll("*").forEach(el => {
      el.classList?.forEach(c => {
        if (c.toLowerCase().includes("msg") || c.toLowerCase().includes("message") || c.toLowerCase().includes("bubble")) {
          clasesMsg.add(c);
        }
      });
    });
    resultado["__clases_msg"] = [...clasesMsg].slice(0, 20);

    // Ver el innerText del primer div con rol 'row' o similar
    const rows = main?.querySelectorAll("[role='row'], [role='listitem']");
    resultado["__rows_count"] = rows?.length || 0;
    resultado["__primer_row_texto"] = rows?.[0]?.innerText?.trim().slice(0, 80) || "";

    return resultado;
  });

  console.log(JSON.stringify(info, null, 2));
  console.log("\n=== FIN — cerrando en 20s ===");
  await sleep(20000);
  await browser.close();
})();