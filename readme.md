```markdown
# WhatsApp → Google Docs → NotebookLM Sync

Sistema de automatización que captura mensajes desde WhatsApp Web, los procesa y los sincroniza en Google Docs como fuente viva para NotebookLM.

---

## 🧠 Overview

Este proyecto implementa un pipeline de ingesta de datos no estructurados (mensajes personales) y los transforma en una fuente de conocimiento actualizable automáticamente.

### Flujo de datos

```

WhatsApp Web (Puppeteer)
↓
Scraper DOM (mensajes)
↓
Parser + Clasificador
↓
Google Docs API (append incremental)
↓
NotebookLM (fuente sincronizada)

```

---

## 🎯 Objetivo

Resolver la limitación de no tener integración directa entre:

- WhatsApp (datos personales no accesibles por API)
- NotebookLM (requiere fuentes estructuradas)

Mediante:
- scraping controlado
- persistencia de sesión
- sincronización incremental

---

## ⚙️ Stack Tecnológico

- Node.js
- Puppeteer (automatización navegador)
- Google Docs API (persistencia)
- OAuth 2.0 (autenticación)
- JSON local (estado)

---

## 📁 Estructura del proyecto

```

whatsapp-notebook-sync/
│
├── index.js                # Orquestador principal
├── config.js              # Configuración del sistema
├── auth.js                # OAuth Google
├── state.json             # Estado (último mensaje)
│
├── core/
│   ├── scraper.js         # Interacción con WhatsApp Web
│   ├── parser.js          # Detección de mensajes nuevos
│   ├── classifier.js      # Clasificación por tags
│
├── services/
│   └── googleDocs.js      # Integración con Google Docs
│
├── utils/
│   └── stateManager.js    # Persistencia local
│
└── session/               # Sesión persistente Puppeteer

````

---

## 🔐 Autenticación

Se utiliza OAuth 2.0 contra Google:

1. `credentials.json` (manual desde Google Cloud)
2. `token.json` (generado automáticamente)

El sistema guarda credenciales localmente y no requiere reautenticación.

---

## 🚀 Setup

### 1. Instalar dependencias

```bash
npm install
````

### 2. Configurar Google Cloud

* Crear proyecto
* Activar Google Docs API
* Crear credenciales OAuth (Desktop App)
* Descargar `credentials.json`

### 3. Ejecutar por primera vez

```bash
node index.js
```

* Autorizar acceso a Google
* Escanear QR de WhatsApp

---

## 🧪 Funcionamiento

### Primera ejecución

* Inicializa sesión de WhatsApp Web
* Escanea QR
* Genera `token.json`
* Guarda sesión en `/session`

### Ejecuciones siguientes

* Reutiliza sesión (sin QR)
* Detecta mensajes automáticamente
* Sin intervención del usuario

---

## 🔁 Sincronización

El sistema:

1. Lee mensajes visibles del DOM
2. Fuerza carga mediante scroll
3. Filtra mensajes nuevos usando estado local
4. Aplica clasificación básica (#tags)
5. Inserta en Google Docs mediante append

---

## 🧠 Clasificación

Sistema basado en prefijos:

```
#idea
#estudio
#reflexion
#codigo
```

Ejemplo de salida:

```
[IDEAS] (2026-04-02 15:23)
#idea crear sistema de notas
```

---

## ⚠️ Limitaciones técnicas

### 1. No API oficial de WhatsApp

* Se utiliza scraping (Puppeteer)
* Dependiente de cambios en DOM

### 2. Render dinámico (React)

* Los mensajes no están completamente disponibles en el DOM
* Se requiere:

  * scroll forzado
  * delays controlados

### 3. Estado basado en texto

* Posible colisión si mensajes idénticos
* Mejora futura: hash o timestamp

---

## 🧱 Decisiones de diseño

### Puppeteer + userDataDir

Permite:

* persistencia de sesión
* evitar re-login QR

### Google Docs como almacenamiento

Ventajas:

* integración directa con NotebookLM
* edición y revisión manual
* bajo costo de implementación

---

## 📈 Posibles mejoras

### Corto plazo

* manejo de duplicados más robusto
* separación en múltiples documentos
* logging estructurado

### Medio plazo

* clasificación automática (NLP)
* resumen de contenido
* indexado semántico

### Largo plazo

* reemplazo de scraping por API (si disponible)
* base de datos intermedia
* arquitectura event-driven

---

## 🖥️ Deployment

### Local

* ejecución continua en máquina personal

### VPS (opcional)

Compatible con:

* Railway
* Render

Limitaciones:

* Puppeteer requiere entorno gráfico o configuración especial

---

## 🧪 Debugging

Problemas comunes:

| Issue               | Causa                | Solución                |
| ------------------- | -------------------- | ----------------------- |
| QR constante        | sesión no persistida | revisar `userDataDir`   |
| No detecta mensajes | DOM no cargado       | agregar delays / scroll |
| No escribe en Docs  | permisos             | compartir documento     |
| Duplicados          | estado simple        | mejorar tracking        |

---

## 🔒 Seguridad

* Credenciales almacenadas localmente
* No se exponen datos externos
* No uso de APIs no autorizadas

---

## 📌 Conclusión

Este sistema implementa una solución práctica para:

* capturar conocimiento informal
* estructurarlo automáticamente
* integrarlo con herramientas de IA

Sin depender de integraciones oficiales inexistentes.

---

## 👨‍💻 Autor

Proyecto desarrollado como solución técnica a la integración indirecta entre plataformas cerradas mediante automatización controlada.

```
```
