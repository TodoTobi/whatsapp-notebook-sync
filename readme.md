# WhatsApp → Google Docs → NotebookLM Sync

Pipeline de automatización que captura mensajes de WhatsApp Web, los clasifica por categoría y los sincroniza incrementalmente en un Google Doc como fuente viva para NotebookLM.

---

## Cómo funciona

```
WhatsApp Web (Puppeteer)
        ↓
  scraper.js  →  parser.js  →  classifier.js
        ↓
  stateManager.js (state.json)
        ↓
  googleDocs.js (Google Docs API)
        ↓
  NotebookLM
```

1. Puppeteer abre WhatsApp Web reutilizando la sesión local.
2. El scraper fuerza scroll para cargar mensajes en el DOM virtualizado de WA.
3. El parser filtra solo los mensajes nuevos desde el último procesado.
4. El classifier les asigna una categoría según el prefijo `#tag`.
5. El texto formateado se escribe al final del Google Doc vía API.
6. El estado (último mensaje) se persiste en `state.json` para sobrevivir reinicios.

---

## Stack

- **Node.js** ≥ 18
- **Puppeteer** — automatización del browser
- **Google Docs API** — escritura incremental
- **OAuth 2.0** — autenticación con Google

---

## Estructura

```
whatsapp-notebook-sync/
│
├── index.js                  # Orquestador principal + graceful shutdown
├── config.js                 # Configuración centralizada
├── auth.js                   # OAuth 2.0 con Google
├── state.json                # Último mensaje procesado (generado automáticamente)
│
├── core/
│   ├── scraper.js            # Puppeteer: abrir WA, scroll, extraer mensajes
│   ├── parser.js             # Filtrar mensajes nuevos desde el último conocido
│   └── classifier.js         # Asignar categoría por #tag
│
├── services/
│   └── googleDocs.js         # appendToDoc() con reintentos automáticos
│
├── utils/
│   └── stateManager.js       # Leer/escribir state.json de forma segura
│
└── session/                  # Sesión persistente de Puppeteer (gitignored)
```

---

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Google Cloud

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Activar la **Google Docs API**
3. Crear credenciales **OAuth 2.0** de tipo _Desktop App_
4. Descargar el archivo y guardarlo como `credentials.json` en la raíz del proyecto

### 3. Configurar `config.js`

```js
CHAT_NAME: "Tu Nombre (Tú)", // como aparece en WhatsApp
DOC_ID: "el-id-de-tu-doc",   // desde la URL del documento
INTERVAL: 60000               // intervalo de polling en ms
```

El `DOC_ID` se obtiene de la URL del documento:
`docs.google.com/document/d/**<DOC_ID>**/edit`

### 4. Compartir el Google Doc

El documento debe estar compartido con la cuenta de Google que usaste para crear las credenciales, con permisos de **editor**.

### 5. Primera ejecución

```bash
node index.js
```

- Si no hay `token.json`: se muestra un link para autorizar → pegás el código → se guarda el token.
- Si no hay sesión de WhatsApp: se abre el browser → escaneás el QR → la sesión queda guardada.
- Las ejecuciones siguientes arrancan directo sin intervención.

---

## Sistema de clasificación

Los mensajes se clasifican por prefijo. El tag puede ir en mayúsculas o minúsculas.

| Tag | Categoría |
|---|---|
| `#idea` | IDEAS |
| `#estudio` | ESTUDIO |
| `#reflexion` / `#reflexión` | REFLEXION |
| `#codigo` / `#código` | CODIGO |
| _(sin tag)_ | OTROS |

Ejemplo de salida en el Doc:

```
[IDEAS] (02/04/2026, 15:23)
#idea crear un sistema de notas automático

[ESTUDIO] (02/04/2026, 15:45)
#estudio revisar apuntes de álgebra lineal
```

---

## Comportamiento en primera ejecución

La primera vez que corre el sistema, guarda el último mensaje visible como punto de partida y **no escribe nada al Doc**. Solo los mensajes que lleguen _después_ de ese momento se sincronizan. Esto evita subir el historial completo del chat al Doc.

Si querés resetear ese punto de partida:

```bash
# Borrar el estado y empezar de cero
rm state.json
```

---

## Robustez implementada

- **Reintentos automáticos** en llamadas a Google Docs API (backoff exponencial, hasta 3 intentos).
- **Escritura atómica** de `state.json` usando archivo temporal + rename para evitar corrupción.
- **Try/catch en el loop de polling** — los errores no detienen la ejecución.
- **Graceful shutdown** — Ctrl+C cierra el browser correctamente antes de salir.
- **Deduplicación de mensajes** — el scraper filtra nodos duplicados que WA puede repetir en el DOM.
- **Batching** — se procesan hasta 50 mensajes por ciclo para evitar writes gigantes.
- **Bloqueo de recursos** — imágenes, fuentes y media no se cargan en el browser (más rápido y liviano).

---

## Debugging

| Problema | Causa probable | Solución |
|---|---|---|
| QR aparece siempre | Sesión no persistida | Verificar que `./session/` existe y no está vacío |
| No detecta mensajes | Selectores del DOM cambiados por WA | Inspeccionar el chat en DevTools y actualizar selectores en `scraper.js` |
| No escribe en Docs | Permisos del documento | Compartir el Doc con la cuenta OAuth con rol Editor |
| Mensajes duplicados | `state.json` corrupto | Borrar `state.json` y reiniciar |
| Error 429 de Google | Rate limiting | El sistema reintenta automáticamente; reducir `INTERVAL` si persiste |
| Token expirado | OAuth token vencido | Borrar `token.json` y reautorizar |

---

## Limitaciones

- **Sin API oficial de WhatsApp**: el scraping depende del DOM de WhatsApp Web, que puede cambiar sin aviso. Si WA actualiza su interfaz, puede ser necesario ajustar los selectores en `scraper.js`.
- **Mensajes visibles en el DOM**: WhatsApp Web virtualiza el listado de mensajes. El scraper fuerza scroll para cargar más, pero mensajes muy antiguos pueden no estar disponibles.
- **Estado basado en texto**: si el último mensaje procesado desaparece del DOM (scroll muy largo), el sistema procesa todos los mensajes visibles como nuevos. En casos normales esto no ocurre.

---

## Deployment

### Local (recomendado)

Ejecución continua en tu máquina. Lo más simple y confiable dado que Puppeteer necesita acceso al browser con interfaz gráfica.

### VPS / servidor headless

Puppeteer puede correr en modo headless (`headless: true` en `scraper.js`), pero WhatsApp Web puede detectarlo y bloquear el acceso. Si usás un servidor, probá primero en modo visible.

---

## Seguridad

- `credentials.json` y `token.json` están en `.gitignore`. Nunca los commitees.
- La carpeta `session/` también está excluida del repositorio.
- No se envían datos a servicios externos salvo Google Docs API con tu propia cuenta.