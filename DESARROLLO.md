# 🛠️ Guía de Desarrollo - TradingView Alerts Microservice

> **Guía completa para desarrollar, probar y desplegar el microservicio**

---

## 📋 Índice

1. [Setup Local](#setup-local)
2. [Arquitectura Técnica](#arquitectura-técnica)
3. [Testing](#testing)
4. [Deployment en Dockploy](#deployment-en-dockploy)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Setup Local

### **Requisitos:**
- Node.js 18+
- npm o pnpm
- Cuenta de Supabase
- Git

**Nota:** Redis y Chromium NO son necesarios para desarrollo local.

---

### **1. Clonar e Instalar:**

```bash
git clone https://github.com/diazpolanco13/tradingview-telegram-bot.git
cd tradingview-telegram-bot
npm install
```

---

### **2. Configurar Variables de Entorno:**

Crea archivo `.env`:

```bash
PORT=5002
NODE_ENV=development

# Supabase (REQUERIDO)
SUPABASE_URL=https://zzieiqxlxfydvexalbsr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis (OPCIONAL en local - usar IP pública para testing)
REDIS_URL=redis://default:password@45.137.194.210:6379

# Encriptación (REQUERIDO)
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# Screenshots (OPCIONAL)
SCREENSHOT_TIMEOUT=60000      # Timeout navegación (60s para charts complejos)
CHART_LOAD_WAIT=8000          # Espera carga del chart (8s optimizado)
SCREENSHOT_WIDTH=1920         # Full HD width (16:9 ratio)
SCREENSHOT_HEIGHT=1080        # Full HD height (recomendado para trading charts)

# Browser Pool (NUEVO - FASE 1)
USE_BROWSER_POOL=true         # Habilitar pool (default: true)
POOL_MIN_BROWSERS=5           # Mínimo siempre abiertos
POOL_MAX_BROWSERS=12          # Máximo en picos
POOL_IDLE_TIMEOUT=1800000     # 30 min
POOL_WARMUP=true              # Pre-cargar TradingView

# Worker Configuration (NUEVO - FASE 1)
WORKER_CONCURRENCY=10         # Screenshots simultáneos
WORKER_RATE_LIMIT_MAX=50      # Máximo jobs por minuto
WORKER_LOCK_DURATION=30000    # Timeout por job (30s)
WORKER_MAX_STALLED=3          # Reintentos máximos

# Rate Limiting (NUEVO - FASE 3B - Anti-abuso)
RATE_LIMIT_PER_MINUTE=10      # Máximo alertas/minuto por usuario
RATE_LIMIT_PER_HOUR=100       # Máximo alertas/hora por usuario
DAILY_LIMIT_FREE=50           # Límite diario Free
DAILY_LIMIT_PRO=600           # Límite diario Pro

# Cuotas por Plan (REQUERIDO) - Alineado con APIDevs
PLAN_FREE_QUOTA=1000          # Free: ~33/día
PLAN_PRO_QUOTA=15000          # Pro: ~500/día
PLAN_LIFETIME_QUOTA=-1        # Lifetime: Ilimitado
DEFAULT_QUOTA=1000
FALLBACK_QUOTA=500
QUOTA_MODE=strict
```

**Generar ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### **3. Iniciar Servidor Local:**

```bash
npm run dev
```

**Output esperado:**
```
✅ Supabase conectado correctamente
✅ Redis conectado correctamente (si está configurado)
⚠️ Puppeteer not available (normal en local)
🚀 Server running on http://localhost:5002
```

---

### **4. Abrir Panel Admin:**

```
http://localhost:5002/admin
```

Desde aquí puedes:
- ✅ Verificar conexiones
- ✅ Probar webhooks
- ✅ Ver señales recientes
- ✅ Gestionar configuraciones

---

## 🏗️ Arquitectura Técnica

### **Componentes Principales:**

```
src/
├── server.js                      # Entry point
│   └── Inicializa Express, Supabase, Redis, Workers
│
├── config/
│   ├── supabase.js                # Cliente Supabase
│   │   └── insertSignal()
│   │   └── updateScreenshotStatus()
│   │   └── getUserConfig()
│   └── redis.js                   # Conexión Redis
│       └── IORedis instance
│
├── services/
│   └── screenshotService.js       # Puppeteer + TradingView
│       ├── init()                 # Inicializar browser
│       ├── captureWithUserCookies()  # Captura PNG
│       └── captureWithTradingViewShare()  # POST a TradingView
│
├── queues/
│   └── screenshotQueue.js         # BullMQ Queue
│       └── Queue('screenshot-processing')
│
├── workers/
│   └── screenshotWorker.js        # BullMQ Worker
│       └── Procesa jobs de screenshots
│       └── Retry: 3 intentos
│       └── Fallback: Supabase Storage
│
├── routes/
│   ├── webhook.js                 # POST /webhook/:token
│   │   └── Valida token
│   │   └── Inserta señal
│   │   └── Encola screenshot
│   │
│   ├── dashboard.js               # API REST
│   │   └── GET /api/signals
│   │   └── PUT /api/signals/:id
│   │   └── GET /api/config
│   │   └── GET /api/stats
│   │
│   └── admin.js                   # Panel de testing
│       └── GET /admin
│
└── utils/
    ├── encryption.js              # AES-256-GCM
    │   └── encrypt()
    │   └── decrypt()
    │
    ├── cookieManager.js           # Legacy (single-user)
    └── logger.js                  # Pino logger
```

---

### **Flujo de Procesamiento:**

```javascript
// 1. WEBHOOK RECIBE ALERTA
router.post('/webhook/:token', async (req, res) => {
  // Validar token en Supabase
  const config = await getUserConfig(token)
  
  // Verificar cuota
  if (config.signals_used_this_month >= config.signals_quota) {
    return res.status(429).json({ error: 'Cuota excedida' })
  }
  
  // Insertar señal
  const signal = await insertSignal(userId, data)
  
  // Encolar screenshot
  await screenshotQueue.add('capture', {
    signalId: signal.id,
    userId,
    ticker,
    chartId,
    cookies: {
      sessionid: decrypt(config.tv_sessionid),
      sessionid_sign: decrypt(config.tv_sessionid_sign)
    }
  })
  
  // Responder inmediatamente
  res.json({ success: true, signal_id: signal.id })
})

// 2. WORKER PROCESA EN BACKGROUND
screenshotWorker.process(async (job) => {
  const { signalId, chartId, ticker, cookies } = job.data
  
  // Método principal: TradingView Share
  try {
    // Capturar PNG con Puppeteer
    const page = await browser.newPage()
    await page.setCookie(cookies)
    await page.goto(`https://tradingview.com/chart/${chartId}/?symbol=${ticker}`)
    await page.waitForTimeout(5000)
    const screenshotBuffer = await page.screenshot({ type: 'png' })
    
    // POST a TradingView
    const formData = new FormData()
    formData.append('preparedImage', screenshotBuffer, 'snapshot.png')
    
    const response = await fetch('https://www.tradingview.com/snapshot/', {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': `sessionid=${cookies.sessionid}; sessionid_sign=${cookies.sessionid_sign}`,
        'Referer': `https://tradingview.com/chart/${chartId}/`
      }
    })
    
    // TradingView devuelve ID corto
    const id = await response.text() // ej: "7r1wKX3R"
    const shareUrl = `https://www.tradingview.com/x/${id}/`
    
    // Actualizar señal
    await updateScreenshotStatus(signalId, 'completed', shareUrl)
    
  } catch (error) {
    // Fallback: Supabase Storage
    const buffer = await captureWithUserCookies()
    const url = await uploadToSupabaseStorage(buffer)
    await updateScreenshotStatus(signalId, 'completed', url)
  }
})
```

---

## 🧪 Testing

### **Test Local (sin screenshots):**

```bash
# 1. Iniciar servidor
npm run dev

# 2. Obtener token de prueba desde Supabase
# Tabla: trading_signals_config
# Campo: webhook_token
# Ejemplo: test-token-for-local-1234567890abcdef

# 3. Enviar señal
curl -X POST http://localhost:5002/webhook/test-token-for-local-1234567890abcdef \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "BINANCE:BTCUSDT",
    "price": 67890.50,
    "signal_type": "Test Local",
    "direction": "LONG"
  }'

# 4. Verificar en Supabase:
# SELECT * FROM trading_signals ORDER BY created_at DESC LIMIT 1;
# Debe aparecer la señal ✅
```

---

### **Test en Producción (completo):**

```bash
# 1. Verificar salud
curl https://alerts.apidevs-api.com/health

# Debe responder:
# { "status": "healthy", "services": { "puppeteer": true } }

# 2. Enviar señal real
curl -X POST https://alerts.apidevs-api.com/webhook/TU_TOKEN_REAL \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "BINANCE:SOLUSDT",
    "price": 145.67,
    "signal_type": "Test Producción",
    "direction": "LONG",
    "chart_id": "Q7w5R5x8"
  }'

# 3. Esperar 25 segundos

# 4. Verificar en Supabase (con MCP de Cursor):
# SELECT screenshot_url, screenshot_status 
# FROM trading_signals 
# WHERE id = 'signal_id_del_response';

# Debe tener:
# screenshot_status: "completed"
# screenshot_url: "https://www.tradingview.com/x/ABC123/"
```

---

### **Verificar Logs en Dockploy:**

```
1. Abrir Dockploy Dashboard
2. Click en tu servicio "telegram-alerts"
3. Ver logs en tiempo real
4. Buscar líneas:
   ✅ "URL de TradingView obtenida exitosamente"
   ✅ "Screenshot completado: Método: tradingview_share"
```

---

## 🚀 Deployment en Dockploy

### **Infraestructura:**

```
┌─────────────────────────────────────────┐
│  DOCKPLOY (CI/CD Platform)             │
├─────────────────────────────────────────┤
│  Service 1: telegram-alerts            │
│  - Container: apidevsservices-telegram  │
│  - Port: 5002 → 80                     │
│  - Auto-deploy: ON                     │
│  - GitHub: diazpolanco13/tradingview-  │
│            telegram-bot                │
│                                         │
│  Service 2: redis-trading              │
│  - Container: apidevsservices-redis    │
│  - Port: 6379                          │
│  - Password: xf003myabgpmviy3           │
│                                         │
│  Domain:                                │
│  - alerts.apidevs-api.com → :5002      │
└─────────────────────────────────────────┘
```

---

### **Variables de Entorno en Dockploy:**

```env
PORT=5002
NODE_ENV=production

# Supabase
SUPABASE_URL=https://zzieiqxlxfydvexalbsr.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis (nombre del servicio en Dockploy)
REDIS_URL=redis://default:xf003myabgpmviy3@apidevsservices-redistrading-fvg1n5:6379

# Encriptación (única para producción)
ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# Screenshots
SCREENSHOT_TIMEOUT=30000
CHART_LOAD_WAIT=5000
```

---

### **Proceso de Deploy:**

```bash
# Desarrollo Local → Producción

# 1. Hacer cambios localmente
git status

# 2. Commit
git add .
git commit -m "feat: descripción del cambio"

# 3. Push a GitHub
git push origin main

# 4. Dockploy detecta push automáticamente
#    ├── Clona última versión
#    ├── npm install (instala dependencias)
#    ├── Docker build (usa Dockerfile)
#    ├── Docker run (inicia contenedor)
#    └── Health check (verifica /health)
#    ⏱️ Tiempo total: 30-60 segundos

# 5. Verificar deployment
curl https://alerts.apidevs-api.com/health

# Debe responder:
# { "status": "healthy", "uptime": 15, ... }
```

---

### **Dockerfile (Incluido):**

```dockerfile
FROM node:18-alpine

# Instalar Chromium para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Workdir
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código
COPY . .

# Exponer puerto
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5002/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start
CMD ["npm", "start"]
```

---

## 🧪 Testing Completo

### **Test 1: Conexión a Supabase**

```bash
# Con MCP de Supabase en Cursor:
# Ejecutar query:
SELECT COUNT(*) FROM trading_signals_config;

# O con curl (desde el microservicio):
curl http://localhost:5002/admin
# Click en "Test Supabase Connection"
```

---

### **Test 2: Webhook con Token Válido**

```bash
# Paso 1: Obtener token de prueba
# En Supabase, ejecutar:
SELECT webhook_token, default_chart_id, cookies_valid 
FROM trading_signals_config 
WHERE cookies_valid = true 
LIMIT 1;

# Paso 2: Enviar señal
curl -X POST http://localhost:5002/webhook/TOKEN_OBTENIDO \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "BINANCE:BTCUSDT",
    "price": 67890.50,
    "signal_type": "Test",
    "direction": "LONG",
    "chart_id": "Q7w5R5x8"
  }'

# Paso 3: Verificar respuesta
# Debe devolver:
# { "success": true, "signal_id": "uuid", "screenshot_queued": true }

# Paso 4: Verificar en Supabase
SELECT * FROM trading_signals 
WHERE id = 'signal_id_del_response';

# Debe tener:
# - ticker: "BINANCE:BTCUSDT"
# - screenshot_status: "pending" o "processing"
```

---

### **Test 3: Screenshots (solo en producción)**

```bash
# Local: NO funciona (falta Chromium)
# Producción: SÍ funciona

# 1. Enviar señal a producción
curl -X POST https://alerts.apidevs-api.com/webhook/TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "BINANCE:ETHUSDT",
    "price": 2456.78,
    "chart_id": "Q7w5R5x8"
  }'

# 2. Ver logs en Dockploy (tiempo real):
# Buscar:
# - "📸 Capturando screenshot con POST directo a TradingView"
# - "✅ PNG generado localmente"
# - "🚀 POSTando imagen a TradingView /snapshot/"
# - "✅ URL de TradingView obtenida: 7r1wKX3R"
# - "🔧 URL construida desde ID"
# - "✅ Screenshot completado: Método: tradingview_share"

# 3. Esperar ~25 segundos

# 4. Verificar URL en Supabase:
SELECT screenshot_url FROM trading_signals 
WHERE id = 'signal_id';

# Debe ser: "https://www.tradingview.com/x/ABC123/"

# 5. Abrir URL en navegador
# Debe mostrar el chart capturado
```

---

## 🔧 Desarrollo

### **Estructura de Desarrollo:**

```bash
# Branch principal
main

# Para nuevas features:
git checkout -b feature/nombre-feature
# Desarrollar...
git commit -m "feat: descripción"
git push origin feature/nombre-feature
# Hacer PR a main

# Para fixes rápidos:
git commit -m "fix: descripción"
git push origin main  # Deploy inmediato
```

---

### **Logs en Desarrollo:**

El servidor usa **Pino** para logs estructurados:

```javascript
// Formato JSON en producción:
{"level":30,"time":1761619505,"msg":"✅ Señal insertada"}

// Formato pretty en desarrollo:
[INFO] ✅ Señal insertada: 584f6be4-d1ed-4b89-8ff7-632e62a85e0d
```

**Ver logs en tiempo real:**
```bash
# Local:
npm run dev  # Logs en consola

# Producción (Dockploy):
# Dashboard → Service → Logs tab
```

---

## 🐛 Troubleshooting

### **Problema: "Redis connection failed"**

**Local:**
```bash
# SOLUCIÓN 1: Deshabilitar Redis
# El servidor funciona SIN Redis (solo sin screenshots)

# SOLUCIÓN 2: Usar Redis remoto
REDIS_URL=redis://default:password@45.137.194.210:6379
```

**Producción:**
```bash
# Verificar que el servicio Redis esté corriendo en Dockploy
# Nombre debe ser: apidevsservices-redistrading-fvg1n5
```

---

### **Problema: "Puppeteer not available"**

**Local:**
```bash
# NORMAL - Chromium no está instalado
# Screenshots NO funcionan en local
# Para probar, usa producción
```

**Producción:**
```bash
# Verificar Dockerfile incluye:
RUN apk add --no-cache chromium

# Ver logs:
# Debe aparecer: "✅ Puppeteer inicializado correctamente"
```

---

### **Problema: "URL inválida recibida de TradingView"**

**Causa:** TradingView devuelve solo el ID (ej: "7r1wKX3R")

**Solución:** Ya implementada en código:
```javascript
// Si no empieza con http, construir URL completa
if (!response.startsWith('http')) {
  finalUrl = `https://www.tradingview.com/x/${response}/`
}
```

**Verificar en logs:**
```
✅ URL de TradingView obtenida: 7r1wKX3R
🔧 URL construida desde ID: https://www.tradingview.com/x/7r1wKX3R/
```

---

### **Problema: "Screenshot siempre en processing"**

**Causa:** Worker no está procesando la cola

**Debugging:**
```bash
# 1. Verificar Redis conectado
curl http://localhost:5002/health
# redis: true ✅

# 2. Ver logs del worker
# Debe aparecer:
# "🔄 Procesando screenshot para señal..."

# 3. Verificar BullMQ queue stats
curl http://localhost:5002/health
# queue.active: debe ser > 0

# 4. Si active = 0 y waiting > 0:
# - Worker no está corriendo
# - Reiniciar servidor
```

---

### **Problema: "Cookies inválidas"**

**Obtener cookies frescas:**

```bash
# 1. Abrir TradingView en navegador
https://www.tradingview.com/

# 2. Login con tu cuenta

# 3. Presionar F12 (DevTools)

# 4. Application → Cookies → https://www.tradingview.com

# 5. Copiar:
sessionid: rawzln0xokhx1k81oix8vhof6gkjxko6 (32 chars)
sessionid_sign: v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys= (47 chars)

# 6. Actualizar en dashboard del usuario
```

---

## 📊 Monitoreo en Producción

### **Métricas Clave:**

```bash
# Queue Length (ideal: < 50)
curl https://alerts.apidevs-api.com/health | jq '.services.queue.waiting'

# Active Workers (ideal: 1-3)
curl https://alerts.apidevs-api.com/health | jq '.services.queue.active'

# Failed Rate (ideal: < 5%)
curl https://alerts.apidevs-api.com/health | jq '.services.queue.failed'
```

---

### **Alertas Recomendadas:**

| Métrica | Threshold | Acción |
|---------|-----------|--------|
| `queue.waiting` | > 100 | Aumentar workers |
| `queue.failed` | > 10% | Revisar logs, verificar cookies |
| `uptime` | < 300s | Restart reciente, monitorear |
| `services.redis` | false | Redis caído, reiniciar servicio |
| `services.puppeteer` | false | Chromium error, rebuild container |

---

## 🔄 CI/CD Pipeline

### **GitHub → Dockploy (Automático):**

```
1. Developer hace commit → push a GitHub
   ↓
2. Dockploy webhook detecta push
   ↓
3. Dockploy ejecuta build:
   ├── git clone latest
   ├── docker build -t imagen:latest .
   ├── docker stop contenedor-anterior
   ├── docker run imagen:latest
   └── health check
   ↓
4. Si health check OK:
   └── Deploy successful ✅
   
5. Si health check FALLA:
   ├── Rollback a versión anterior
   └── Notificación de error
```

**Tiempo total:** 30-60 segundos

---

## 🔐 Seguridad en Producción

### **1. Encriptación de Cookies:**

```javascript
// Las cookies se guardan encriptadas en Supabase
const encrypted = encrypt(cookieValue)
// Resultado en DB: "eyJpdiI6IjEyMzQ1Njc4OTBhYmNkZWYiLCJjb250..."

// En el worker, se desencriptan:
const cookieValue = decrypt(encrypted)
```

### **2. Regenerar Webhook Token:**

```sql
-- En Supabase:
UPDATE trading_signals_config 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE user_id = 'user_uuid';
```

### **3. Rate Limiting:**

Por usuario, configurado en `signals_quota`:
- Free: 100 señales/mes
- Pro: 500 señales/mes
- Premium: Ilimitado (-1)

---

## 📈 Performance Optimization

### **Actual:**
- Webhook response: ~850ms
- Screenshot total: ~21-25s (con CHART_LOAD_WAIT=5000)

### **Optimizaciones Implementadas:**
- ✅ POST directo a TradingView (evita Alt+S)
- ✅ Construcción de URL desde ID
- ✅ Fallback automático a Supabase
- ✅ CHART_LOAD_WAIT reducido de 10s a 5s

### **Próximas Optimizaciones:**
- [ ] Pool de browsers keep-alive (-5s)
- [ ] Detección dinámica de carga (-3s)
- [ ] Caché de navegación (-2s)
- **Meta: 21s → 10-12s**

---

## 🔄 Actualizar en Producción

### **Proceso Seguro:**

```bash
# 1. Hacer cambios en branch de feature
git checkout -b fix/mejora-performance
# ... código ...
git commit -m "fix: reducir tiempo de captura"

# 2. Probar localmente (sin Redis, solo webhook)
npm run dev
curl -X POST http://localhost:5002/webhook/test-token...

# 3. Si funciona, merge a main
git checkout main
git merge fix/mejora-performance

# 4. Push (deploy automático)
git push origin main

# 5. Monitorear deployment en Dockploy
# Logs → Ver inicio del servidor

# 6. Verificar health
curl https://alerts.apidevs-api.com/health

# 7. Test en producción
curl -X POST https://alerts.apidevs-api.com/webhook/...
```

---

### **Rollback (si algo falla):**

```bash
# Opción 1: Git revert
git log --oneline -5  # Ver últimos commits
git revert HEAD  # Revertir último commit
git push origin main  # Deploy del revert

# Opción 2: Force push a commit anterior
git reset --hard f4c98ae  # Commit que funciona
git push origin main --force  # Deploy forzado
```

---

## 📂 Archivos Importantes

### **Configuración:**

```
.env                    # Variables de entorno (NO commitear)
.env.example.txt        # Template de variables
package.json            # Dependencias
Dockerfile              # Docker image
docker-compose.yml      # Compose para local (opcional)
```

### **Source Code:**

```
src/server.js           # Entry point - inicialización
src/routes/webhook.js   # Webhook multi-tenant
src/routes/dashboard.js # API REST para Next.js
src/workers/screenshotWorker.js  # Procesador async
src/services/screenshotService.js  # Puppeteer + TradingView POST
```

### **Documentación:**

```
README.md               # Overview general
API.md                  # Documentación de endpoints
DESARROLLO.md           # Esta guía
```

---

## 💡 Tips de Desarrollo

### **1. Testing Rápido:**

```bash
# Crear alias en .bashrc o .zshrc:
alias test-webhook='curl -X POST http://localhost:5002/webhook/test-token-for-local-1234567890abcdef -H "Content-Type: application/json" -d '"'"'{"ticker":"BINANCE:BTCUSDT","price":67890}'"'"''

# Uso:
test-webhook
```

---

### **2. Ver Logs de BullMQ:**

```javascript
// Agregar en src/server.js temporalmente:
screenshotQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job waiting: ${jobId}`)
})

screenshotQueue.on('active', (job) => {
  console.log(`🔄 Job active: ${job.id}`)
})

screenshotQueue.on('completed', (job) => {
  console.log(`✅ Job completed: ${job.id}`)
})
```

---

### **3. Debugging de Screenshots:**

```javascript
// En screenshotService.js, agregar:
const debugPath = `/tmp/debug-${Date.now()}.png`
await fs.writeFile(debugPath, screenshotBuffer)
logger.info({ debugPath }, '📸 Screenshot debug guardado')

// En producción:
// docker exec -it container_id ls -la /tmp/
// docker cp container_id:/tmp/debug-123.png ./local/
```

---

## 🎯 Checklist de Deploy

Antes de hacer push a producción:

- [ ] ✅ Código probado localmente
- [ ] ✅ Variables de entorno verificadas
- [ ] ✅ Commit con mensaje descriptivo
- [ ] ✅ Package.json actualizado si hay nuevas deps
- [ ] ✅ Logs de debug removidos
- [ ] ✅ Health check funciona local
- [ ] ⚠️ **NO** commitear `.env`
- [ ] ⚠️ **NO** commitear `node_modules`

---

## 📚 Recursos Útiles

### **Supabase:**
- Dashboard: https://supabase.com/dashboard/project/zzieiqxlxfydvexalbsr
- API Docs: https://supabase.com/docs/reference/javascript/introduction

### **BullMQ:**
- Docs: https://docs.bullmq.io/
- Patterns: https://docs.bullmq.io/patterns/

### **Puppeteer:**
- Docs: https://pptr.dev/
- Troubleshooting: https://pptr.dev/troubleshooting

### **Dockploy:**
- Dashboard: Tu URL de Dockploy
- Logs: Dashboard → Service → Logs

### **TradingView:**
- Webhooks: https://www.tradingview.com/support/solutions/43000529348
- Variables: https://www.tradingview.com/pine-script-docs/

---

## 🎓 Conocimientos Requeridos

Para contribuir al proyecto:

### **Nivel Básico:**
- JavaScript/Node.js
- Express.js
- REST APIs
- Git/GitHub

### **Nivel Intermedio:**
- Async/await, Promises
- Supabase (PostgreSQL)
- Docker básico
- Environment variables

### **Nivel Avanzado:**
- BullMQ/Redis
- Puppeteer/Headless browsers
- Encriptación (AES-256-GCM)
- Row Level Security
- CI/CD con Dockploy

---

## ✅ Estado del Proyecto

```
🟢 Producción:         https://alerts.apidevs-api.com/
🟢 Supabase:           Conectado
🟢 Redis:              Conectado (Dockploy)
🟢 Puppeteer:          Funcionando
🟢 Screenshots:        TradingView CDN (no Storage)
🟢 Multi-tenant:       Completamente funcional
🟢 API REST:           15+ endpoints activos
🟢 RLS:                Aislamiento completo
🟢 Encriptación:       AES-256-GCM
🟢 Cuotas:             Configurables desde .env
🟢 /api/quota:         Endpoint para dashboard
🟢 Browser Pool:       5-12 navegadores (auto-scaling)
🟢 Worker Concurrency: 10 screenshots simultáneos
🟢 Rate Limiting:      Multi-nivel (min/hora/día) por usuario
🟢 Health Check:       Verificación real de servicios
🟢 Graceful Shutdown:  30s timeout, cierre limpio
🟢 Anti-popups:        CSS + detección activa
🟢 Monitoring:         /admin/metrics, /pool-status, /queue-stats
```

**Capacidad Actual:** ~345 usuarios (500 alerts/día c/u)  
**Tasa de Éxito:** 99.5%+  
**Tiempo de Screenshot:** ~6-8 segundos

---

## 🚀 Siguiente Nivel

### **Features en Roadmap:**

1. **Layout ID Support** (próximo)
   - Usar layouts de TradingView directamente
   - Usuario configura TODO en TradingView
   - No necesita configurar nada en código

2. **Hot Chart Pool** (futuro)
   - Browsers siempre abiertos
   - Charts pre-cargados
   - Tiempo: 21s → 8-10s

3. **WebSocket Real-time** (futuro)
   - Notificaciones push al dashboard
   - Sin polling, eventos directos

---

**Versión:** 2.1.0  
**Última actualización:** 29 Octubre 2025  
**Autor:** @diazpolanco13  
**Optimizaciones Aplicadas:** FASE 1, 2, 3A, 3B completadas ✅

---

## 📊 Sistema de Cuotas Configurable

### **Configuración desde Variables de Entorno:**

```env
# Planes de APIDevs (realistas para traders activos)
PLAN_FREE_QUOTA=1000       # Free: ~33/día (2 gráficos, alertas cada 1h)
PLAN_PRO_QUOTA=15000       # Pro: ~500/día (10 gráficos, alertas cada 15min)
PLAN_LIFETIME_QUOTA=-1     # Lifetime: Ilimitado (beneficio VIP)

# Cuotas por defecto
DEFAULT_QUOTA=1000         # Si no se encuentra el plan
FALLBACK_QUOTA=500         # Sin plan asignado

# Modo de validación
QUOTA_MODE=strict          # strict/soft/disabled
```

### **Endpoints de Testing:**

```bash
# Ver configuración de planes
curl https://alerts.apidevs-api.com/test/plans

# Ver cuota de un usuario
curl https://alerts.apidevs-api.com/test/quota/:userId

# Ver cuota del usuario autenticado (dashboard)
curl https://alerts.apidevs-api.com/api/quota \
  -H "Authorization: Bearer JWT_TOKEN"
```

### **Cómo Funciona:**

1. **Webhook recibe alerta** → Valida token
2. **Sistema lee cuota** desde `trading_signals_config.signals_quota`
3. **Compara con usado** (`signals_used_this_month`)
4. **Aplica regla según QUOTA_MODE:**
   - `strict`: Rechaza si excede
   - `soft`: Permite pero registra advertencia
   - `disabled`: Ignora validación

### **Logs al Iniciar:**

```
📋 Cargando configuración de planes...
📊 Configuración de Planes:
   Free: 1000 señales/mes (1080p) - ~33/día
   Pro: 15000 señales/mes (1080p) - ~500/día
   Lifetime: Ilimitado (4k)
   Default Quota: 1000
   Fallback Quota: 500
   Quota Mode: strict
```

---

## 🚀 Optimizaciones Implementadas (Oct 2025)

### **FASE 1: Escalabilidad Básica**
✅ **Browser Pool**
- 5-12 navegadores en memoria
- Reutilización de browsers
- Auto-scaling según demanda
- Reduce tiempo de 20s → 6-8s

✅ **Worker Concurrency**
- Aumentado de 2 → 10 workers simultáneos
- Rate limit de cola: 50 jobs/minuto
- Timeout de 30s por job
- 3 reintentos automáticos

**Impacto:** Capacidad aumentó de 70 → 345 usuarios

---

### **FASE 2: Monitoring**
✅ **Endpoints de Métricas**
- `/admin/metrics` - Dashboard completo
- `/admin/pool-status` - Estado del pool
- `/admin/queue-stats` - Jobs recientes

✅ **Health Check Mejorado**
- `/health` con verificación real de servicios
- HTTP 200 (healthy) o 503 (degraded)
- Lista de errores específicos

✅ **Graceful Shutdown**
- Timeout de 30s
- Cierre ordenado de recursos
- Espera que terminen jobs activos
- Captura de excepciones no manejadas

**Impacto:** Visibilidad completa del sistema, zero downtime deploys

---

### **FASE 3A: Protección del Sistema**
✅ **Bloqueo de Popups de TradingView**
- CSS injection con selectores exactos
- Detección activa de botones de cierre
- 8 selectores diferentes
- 99%+ screenshots limpios

**Impacto:** Screenshots profesionales sin ads

---

### **FASE 3B: Rate Limiting Multi-nivel**
✅ **Protección Anti-abuso**
- Límite por minuto: 10 alertas/min (anti-burst)
- Límite por hora: 100 alertas/hora (anti-spam)
- Límite diario: 50 (Free) / 600 (Pro) / ∞ (Lifetime)
- HTTP 429 con retry_after
- Aislamiento por usuario (Redis keys únicas)

✅ **Campo user_plan en DB**
- Migración aplicada
- Check constraint: 'free' | 'pro' | 'lifetime'
- Índice para queries rápidas

**Impacto:** Sistema protegido contra colapso, un usuario no afecta a otros

---

### **Mejoras Adicionales:**
✅ Eliminación de fallback de Supabase Storage (solo TradingView CDN)
✅ Fix de errores "method is not defined"
✅ Fix de reintentos que causaban notificaciones Telegram duplicadas
✅ Logging mejorado y estructurado

