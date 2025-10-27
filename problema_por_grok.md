Automatización de Snapshots en TradingView con Puppeteer
Introducción
Este documento resume el problema que estás enfrentando al desarrollar un microservicio en Node.js para capturar snapshots automáticos de gráficos personalizados en TradingView usando Puppeteer en modo headless (en un entorno Docker con Alpine Linux). Incluye mi análisis basado en las descripciones, logs, capturas de pantalla y network requests proporcionados, así como las soluciones recomendadas para lograr URLs permanentes, confiables y automatizables.
El Problema
Estás construyendo un sistema que recibe alertas de TradingView vía webhook, las procesa con Supabase y BullMQ, y luego usa un worker con Puppeteer para capturar snapshots de gráficos personalizados (con indicadores del usuario). El objetivo es obtener URLs permanentes como https://www.tradingview.com/x/ID-unico/ que no expiren, muestren el gráfico exacto y funcionen en modo headless sin interfaz gráfica.
Detalles Específicos del Problema:

Arquitectura Actual: TradingView Alert → Webhook → Supabase → BullMQ → Worker (Puppeteer en headless Chrome con Alpine Linux).
Stack: Node.js 18 (Docker), Puppeteer (Headless Chrome), Chromium en Alpine.
Flujo Intentado:

Navegar a https://www.tradingview.com/chart/[CHART_ID]?symbol=[TICKER] con cookies de autenticación (sessionid y sessionid_sign).
Esperar carga del gráfico (10 segundos).
Inyectar cookies y presionar Alt + S usando Puppeteer (page.keyboard.down('Alt'); page.keyboard.press('KeyS'); etc.).
Esperar modal de "Share" (3 segundos).
Extraer la URL usando 4 estrategias:

Estrategia 1: Buscar input en DOM con querySelectorAll('input') y filtrar por valor que incluya /x/.
Estrategia 2: Simular Ctrl + C para copiar del clipboard.
Estrategia 3: Screenshot de debug.
Estrategia 4: Regex en HTML completo para URLs como https://www.tradingview.com/x/[a-zA-Z0-9]+/.




Síntomas:

Alt + S no genera snapshots nuevos en headless; siempre devuelve la misma URL antigua (e.g., https://www.tradingview.com/x/4A0WmmVc/).
Estrategias 1 y 2 fallan porque el modal no se abre.
Estrategia 4 siempre extrae la misma URL cacheada.
Cookies se aplican correctamente (verificado en logs: 8 cookies total, sessionid 32 chars, sign 47 chars).
Funciona en modo headed (con interfaz visual), pero no en headless.


Requisitos Deseados:

URLs permanentes (no expiren).
Gráficos personalizados (con indicadores del usuario).
Funcione en headless (sin GUI, en Docker).
Soporte múltiples alertas por minuto (escalable).


Entorno: Docker (Alpine Linux) en Dockploy, viewport 1920x1080, screenshots en /tmp/.

Análisis
Basado en las capturas de pantalla, logs y network tabs proporcionados, el issue principal es que el shortcut Alt + S (o su simulación) no activa correctamente el flujo de generación de snapshots en modo headless. Aquí un desglose:
Causas Técnicas:

Limitaciones de Headless Mode: En headless: true (modo clásico), Puppeteer/Chrome no emula eventos de teclado/UI de manera idéntica a un navegador con cabeza. Shortcuts app-specific como Alt + S dependen de un "foco de ventana" y rendering completo, que falla en entornos sin GUI, resultando en snapshots no actualizados (cacheados).

No requiere X11, pero eventos sintéticos no triggers el modal de "Share".
TradingView no bloquea bots deliberadamente (términos permiten uso personal), pero detecta comportamientos inusuales.


Network Analysis (de tus capturas):

Al presionar Alt + S, se hace un POST a https://www.tradingview.com/snapshot/ con multipart/form-data.

Payload: Incluye preparedImage (PNG binario del gráfico generado client-side via canvas).
Headers: Cookies para auth, Referer (URL del chart), User-Agent, etc.
Respuesta: Texto plano con la URL nueva (e.g., https://www.tradingview.com/x/ID-nuevo/).


Otros requests: Fetches como /blobhttps... (probablemente temp blob para imagen), /report... (analytics).
Esto confirma que el snapshot se genera client-side y se sube al servidor para URL permanente.


Fallos en Estrategias:

1 y 2: No encuentran modal/clipboard porque Alt + S no lo abre.
3: Útil para debug, pero no extrae URL.
4: Regex captura URLs antiguas en HTML (cache).


Otras Observaciones:

Cookies válidas y chart ID (Q7w5R5x8) correctos.
Rendering en headless es parcial; canvas/UI no siempre se actualiza para snapshots frescos.
Escalabilidad: Múltiples alertas requieren optimización (e.g., pool de browsers) para evitar overhead.



Pruebas y Evidencia:

En headed mode: Funciona (modal abre, URL nueva en clipboard).
En headless: Siempre misma URL, modal no detectado.
Network: POST exitoso en headed genera ID único; en headless, posiblemente no se triggers o usa cache.

Soluciones Recomendadas
Recomiendo cambiar de shortcuts a enfoques más robustos. Prioriza la replicación del POST directo para simplicidad y escalabilidad. Aquí las opciones, ordenadas por preferencia:
1. Replicar el POST Interno (Mejor Opción: Confiable y Eficiente)

Descripción: Usa Puppeteer para renderizar el chart y tomar un PNG local, luego POSTea el buffer a /snapshot/ con headers/cookies para obtener la URL oficial de TradingView.
Ventajas: Evita UI simulation, rápido (~10-15s), genera URLs nuevas cada vez, funciona en headless.
Implementación (Código Node.js):
javascriptconst puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Cookies
const cookies = [
  { name: 'sessionid', value: 'rawzln0xokhx1k81oix8vhof6gkjxko6', domain: '.tradingview.com' },
  { name: 'sessionid_sign', value: 'v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys=', domain: '.tradingview.com' }
];

async function generateSnapshot(chartId, symbol) {
  const browser = await puppeteer.launch({
    headless: 'new', // Modo moderno para mejor rendering
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setCookie(...cookies);

  await page.goto(`https://www.tradingview.com/chart/${chartId}/?symbol=${symbol}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.chart-container.active', { timeout: 15000 });
  await page.waitForTimeout(3000); // Espera indicadores

  const chartElement = await page.$('.chart-container');
  const buffer = await chartElement.screenshot({ type: 'png' });

  await browser.close();

  const form = new FormData();
  form.append('preparedImage', buffer, 'snapshot.png');

  const response = await fetch('https://www.tradingview.com/snapshot/', {
    method: 'POST',
    body: form,
    headers: {
      ...form.getHeaders(),
      'Cookie': `sessionid=rawzln0xokhx1k81oix8vhof6gkjxko6; sessionid_sign=v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys=`,
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Referer': `https://www.tradingview.com/chart/${chartId}/`,
      'Accept': '*/*',
      'Origin': 'https://www.tradingview.com'
    }
  });

  if (response.ok) {
    const url = await response.text();
    return url.trim();
  } else {
    throw new Error(`Error: ${response.status}`);
  }
}

// Uso: const url = await generateSnapshot('Q7w5R5x8', 'BINANCE:BTCUSDT.P');

Consejos: Prueba en local primero. Si falla, loggea response.text(). Optimiza para BullMQ (reusa browsers).

2. Simular Clics en el Botón de Snapshot

Descripción: Cambia Alt + S por clics sintéticos en el ícono de cámara y "Copy link" usando Puppeteer.
Ventajas: Más robusto que shortcuts, fuerza generación nueva.
Implementación: Ver código en respuestas previas (busca selector button[data-name="header-toolbar-snapshot"], luego clic en menú).
Cuándo Usar: Si el POST falla por validaciones server-side.

3. Usar Servicios Externos (Alternativa sin Puppeteer)

Descripción: Integra APIs como CHART-IMG para snapshots autenticados.
Ventajas: Escalabilidad alta, no overhead de browser.
Ejemplo CURL:
bashcurl -X POST https://api.chart-img.com/v2/tradingview/layout-chart/Q7w5R5x8/storage \
  -H "x-api-key: TU_API_KEY" \
  -H "tradingview-session-id: rawzln0xokhx1k81oix8vhof6gkjxko6" \
  -H "tradingview-session-id-sign: v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys=" \
  -d '{"interval":"15","theme":"dark"}'

Cuándo Usar: Para producción, si Puppeteer es inestable.

4. Otras Alternativas

Charting Library de TradingView: Embed en HTML local y usa widget.takeSnapshotUrl().
Screenshot Local + Upload: Toma PNG con Puppeteer y sube a Supabase/S3 para URL propia (no nativa de TradingView).

Conclusión
El problema radica en limitaciones de headless para eventos UI, pero replicando el POST o simulando clics, puedes lograr una solución estable. Implementa la opción 1 primero y prueba con tu chart ID. Si necesitas ajustes, proporciona logs adicionales.