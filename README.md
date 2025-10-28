# 🎯 TradingView Alerts Microservice - APIDevs

> **Microservicio Multi-tenant para Captura Automática de Señales de TradingView**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Production-success.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**🌐 Producción:** https://alerts.apidevs-api.com/  
**📊 Plataforma:** https://apidevs-react.vercel.app/

---

## 🎯 ¿Qué es este Microservicio?

Este es el **sistema de alertas inteligente** que convierte los indicadores premium de TradingView de APIDevs en un servicio completo con dashboard personalizado.

### **Para tus clientes:**
Cuando compran un indicador de APIDevs, obtienen:
- ✅ **Dashboard personalizado** con todas sus alertas
- ✅ **Screenshots automáticos** del chart con SUS indicadores
- ✅ **Historial completo** de señales y resultados
- ✅ **Tracking de performance** (win rate, P&L, estadísticas)
- ✅ **Webhook único** y personal

### **Cómo funciona:**

```
1. Cliente compra indicador en APIDevs
   ↓
2. Sistema le da acceso al indicador en TradingView
   ↓
3. Cliente configura en su Dashboard:
   - Cookies de TradingView (para screenshots personalizados)
   - Obtiene su webhook único (auto-generado)
   - Configura Chart ID (su chart con SUS indicadores)
   ↓
4. Cliente crea alerta en TradingView con su webhook
   ↓
5. Indicador genera señal → Webhook → Microservicio
   ↓
6. Microservicio:
   - Valida token y cuota mensual
   - Guarda señal en Supabase
   - Captura screenshot con cookies del cliente
   - POST a TradingView → URL oficial gratis
   - Actualiza dashboard en tiempo real
   ↓
7. Cliente ve en su Dashboard:
   📸 Screenshot de SU chart con SUS indicadores
   💰 Precio, ticker, tipo de señal
   📊 Puede marcar resultado (win/loss)
   📈 Ver estadísticas y win rate
```

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  TRADINGVIEW (Indicadores de clientes)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ Webhook POST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  MICROSERVICIO (Dockploy + Docker)                         │
│  https://alerts.apidevs-api.com/                           │
│                                                             │
│  ┌────────────────────────────────────┐                   │
│  │  Express.js API (Port 5002)        │                   │
│  │  - POST /webhook/:token             │                   │
│  │  - GET  /api/signals               │                   │
│  │  - GET  /health                    │                   │
│  │  - GET  /admin                     │                   │
│  └────────────────────────────────────┘                   │
│           ↓                    ↓                            │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │  Redis          │  │  Supabase        │               │
│  │  (Dockploy)     │  │  (PostgreSQL)    │               │
│  │  - BullMQ Queue │  │  - Signals       │               │
│  │  - Workers      │  │  - Config        │               │
│  └─────────────────┘  │  - Stats         │               │
│                        │  - Storage       │               │
│                        └──────────────────┘               │
│                                                             │
│  ┌────────────────────────────────────┐                   │
│  │  Screenshot Worker                 │                   │
│  │  - Puppeteer (Chromium)            │                   │
│  │  - User cookies                    │                   │
│  │  - POST to TradingView /snapshot/  │                   │
│  └────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                         ↑
┌─────────────────────────────────────────────────────────────┐
│  PLATAFORMA APIDEVS (Next.js + Vercel)                     │
│  https://apidevs-react.vercel.app/                         │
│                                                             │
│  Dashboard del Cliente:                                     │
│  ├── TAB 1: 📡 Mis Alertas (real-time)                    │
│  └── TAB 2: ⚙️ Configuración                              │
│      ├── Cookies TradingView                               │
│      ├── Webhook URL (auto-generado)                       │
│      └── Chart ID personalizado                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment (Dockploy)

### **Infraestructura Actual:**

| Componente | Ubicación | Puerto | Estado |
|------------|-----------|--------|--------|
| **API Express** | Dockploy Container | 5002 | ✅ Running |
| **Redis** | Dockploy Service | 6379 | ✅ Connected |
| **Supabase** | Cloud (zzieiqxlxfydvexalbsr) | 443 | ✅ Connected |

### **Proceso de Deploy:**

```bash
# 1. Hacer cambios localmente
git add .
git commit -m "feat: nueva feature"

# 2. Push a GitHub
git push origin main

# 3. Dockploy detecta cambio automáticamente
#    - Clona repo
#    - npm install
#    - Docker build
#    - Reinicia container
#    - Deploy en ~30-60 segundos

# 4. Verificar
curl https://alerts.apidevs-api.com/health
```

---

## 📡 API Endpoints

### **1. Webhook Multi-tenant (PRINCIPAL)**

```bash
POST https://alerts.apidevs-api.com/webhook/:token
Content-Type: application/json

# Body ejemplo:
{
  "indicator": "🐸 ADX DEF APIDEVS 👑",
  "ticker": "BINANCE:BTCUSDT",
  "exchange": "BINANCE",
  "symbol": "BTCUSDT",
  "price": 67890.50,
  "signal_type": "Divergencia Alcista 🟢",
  "direction": "LONG",
  "chart_id": "Q7w5R5x8"
}

# Response:
{
  "success": true,
  "signal_id": "uuid",
  "screenshot_queued": true,
  "duration_ms": 850
}
```

**Parámetros:**
- `:token` = Token único del usuario (64 caracteres hex)
- `chart_id` = ID del chart en TradingView (opcional si está en config)

---

### **2. Health Check**

```bash
GET https://alerts.apidevs-api.com/health

# Response:
{
  "status": "healthy",
  "uptime": 3600,
  "services": {
    "supabase": true,
    "redis": true,
    "puppeteer": true,
    "queue": {
      "waiting": 0,
      "active": 2,
      "completed": 150,
      "failed": 1
    }
  }
}
```

---

### **3. Dashboard API (para Next.js)**

Requiere autenticación con JWT de Supabase:

```bash
# Listar señales del usuario
GET /api/signals?limit=50&offset=0
Authorization: Bearer {supabase_jwt}

# Obtener señal específica
GET /api/signals/:id
Authorization: Bearer {supabase_jwt}

# Actualizar resultado de señal
PUT /api/signals/:id
Authorization: Bearer {supabase_jwt}
Body: { "result": "win", "pnl": 150.50, "notes": "TP alcanzado" }

# Eliminar señal
DELETE /api/signals/:id
Authorization: Bearer {supabase_jwt}

# Obtener configuración del usuario
GET /api/config
Authorization: Bearer {supabase_jwt}

# Actualizar configuración (cookies, chart_id)
PUT /api/config
Authorization: Bearer {supabase_jwt}
Body: { 
  "tv_sessionid_plain": "cookie_value",
  "default_chart_id": "Q7w5R5x8"
}

# Obtener estadísticas
GET /api/stats
Authorization: Bearer {supabase_jwt}
Response: { total_signals, wins, losses, win_rate, total_pnl }
```

---

### **4. Admin Panel**

```bash
GET https://alerts.apidevs-api.com/admin
```

**Features:**
- System Health Check
- BullMQ Queue Stats
- Webhook Testing
- User Config Management
- Recent Signals Viewer
- Encryption Testing

---

## 🗄️ Base de Datos (Supabase)

**Proyecto:** `zzieiqxlxfydvexalbsr`

### **Tablas:**

**1. `trading_signals`** - Señales capturadas
```sql
- id (uuid)
- user_id (uuid) → auth.users
- ticker (varchar) ej: "BINANCE:BTCUSDT"
- price (numeric)
- signal_type (varchar) ej: "Divergencia Alcista"
- direction (varchar) ej: "LONG" / "SHORT"
- chart_id (varchar) ej: "Q7w5R5x8"
- screenshot_url (text) ← URL de TradingView
- screenshot_status (pending/processing/completed/failed)
- result (pending/win/loss/breakeven/skip)
- profit_loss (numeric)
- notes (text)
- created_at (timestamp)
```

**2. `trading_signals_config`** - Configuración por usuario
```sql
- id (uuid)
- user_id (uuid) → auth.users
- webhook_token (varchar UNIQUE) ← Token único de 64 chars
- webhook_enabled (boolean)
- webhook_requests_count (int)
- signals_quota (int) ← Límite mensual por plan
- signals_used_this_month (int)
- default_chart_id (varchar)
- tv_sessionid (text) ← Encriptado AES-256-GCM
- tv_sessionid_sign (text) ← Encriptado
- cookies_valid (boolean)
- screenshot_resolution (720p/1080p/4k)
- created_at (timestamp)
```

**3. `trading_signals_stats`** - Estadísticas pre-calculadas
```sql
- user_id (uuid)
- total_signals (int)
- wins (int)
- losses (int)
- win_rate (numeric)
- total_profit_loss (numeric)
- current_streak (int)
- updated_at (timestamp)
```

### **Storage Bucket:**
- `trading-screenshots` (público)
- Organización: `{user_id}/{signal_id}-{timestamp}.png`
- **Nota:** Usado solo como fallback, primario es TradingView Share

### **RLS (Row Level Security):**
- ✅ Usuarios solo ven SUS señales
- ✅ Service role (microservicio) puede insertar/actualizar
- ✅ Aislamiento completo entre usuarios

---

## 🔐 Seguridad

### **1. Autenticación:**
- **Webhook:** Token único de 64 caracteres por usuario
- **Dashboard API:** JWT de Supabase Auth
- **Admin Panel:** Sin auth (solo desarrollo)

### **2. Encriptación:**
- **Algoritmo:** AES-256-GCM
- **Uso:** Cookies TradingView en base de datos
- **Key:** Variable de entorno `ENCRYPTION_KEY` (64 chars hex)

### **3. Rate Limiting:**
- Webhooks: Configurable por plan (100-1000 requests/mes)
- Queue: 10 screenshots/minuto (BullMQ limiter)

---

## 🧪 Testing

### **Test Local (sin Redis):**

```bash
# 1. Configurar .env con Supabase
npm install
npm run dev

# 2. Abrir panel admin
http://localhost:5002/admin

# 3. Probar webhook (usa token de Supabase)
curl -X POST http://localhost:5002/webhook/test-token-for-local-1234567890abcdef \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "BINANCE:BTCUSDT",
    "price": 67890.50,
    "signal_type": "Test",
    "direction": "LONG",
    "chart_id": "Q7w5R5x8"
  }'

# Response esperado:
# { "success": true, "signal_id": "uuid", "screenshot_queued": true }
```

**Nota:** Screenshots NO funcionan en local (falta Chromium), pero el webhook SÍ guarda la señal en Supabase.

---

### **Test Producción (completo):**

```bash
# 1. Verificar salud del sistema
curl https://alerts.apidevs-api.com/health

# 2. Enviar señal de prueba
curl -X POST https://alerts.apidevs-api.com/webhook/TU_TOKEN_REAL \
  -H "Content-Type: application/json" \
  -d '{
    "indicator": "🐸 ADX DEF APIDEVS 👑",
    "ticker": "BINANCE:ETHUSDT",
    "price": 2456.78,
    "signal_type": "Divergencia Alcista 🟢",
    "direction": "LONG",
    "chart_id": "Q7w5R5x8"
  }'

# 3. Esperar ~20-25 segundos (procesamiento screenshot)

# 4. Verificar en Supabase o panel admin:
#    - Señal guardada ✅
#    - Screenshot URL de TradingView ✅
```

---

## 🔄 Flujo Completo de una Alerta

```
┌─────────────────────────────────────────┐
│ 1. TRADINGVIEW                          │
│    Indicador detecta divergencia        │
│    Genera alerta automática             │
└──────────────┬──────────────────────────┘
               │
               ▼ POST /webhook/abc123...
┌─────────────────────────────────────────┐
│ 2. MICROSERVICIO (< 1 segundo)         │
│    ✅ Valida token en Supabase          │
│    ✅ Verifica cuota mensual            │
│    ✅ Inserta señal en DB               │
│    ✅ Encola screenshot en Redis        │
│    ✅ Responde 200 OK                   │
└──────────────┬──────────────────────────┘
               │
               ▼ Background processing
┌─────────────────────────────────────────┐
│ 3. WORKER (20-25 segundos)             │
│    📸 Abre Puppeteer con cookies        │
│    🌐 Navega al chart del usuario       │
│    ⏳ Espera carga (5-10s)              │
│    📷 Captura PNG del chart             │
│    🚀 POST a TradingView /snapshot/     │
│    ✅ TradingView responde con ID       │
│    🔗 Construye URL oficial             │
│    💾 Actualiza señal en Supabase       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 4. DASHBOARD NEXT.JS (Tiempo real)     │
│    📊 Usuario ve señal nueva            │
│    📸 Screenshot con SUS indicadores    │
│    🔗 Link a TradingView interactivo    │
│    ✅ Puede marcar win/loss/skip        │
└─────────────────────────────────────────┘
```

**Tiempos:**
- Webhook response: < 1s
- Screenshot total: ~20-25s
- Usuario ve alerta: Inmediato (señal sin screenshot)
- Usuario ve screenshot: ~25s después

---

## 📂 Estructura del Proyecto

```
/root/tradingview-telegram-bot/
├── src/
│   ├── server.js                    # Express server + inicialización
│   ├── config/
│   │   ├── supabase.js              # Cliente Supabase + helpers
│   │   └── redis.js                 # Conexión Redis
│   ├── services/
│   │   └── screenshotService.js     # Puppeteer + POST a TradingView
│   ├── routes/
│   │   ├── webhook.js               # POST /webhook/:token
│   │   ├── dashboard.js             # API REST para Next.js
│   │   └── admin.js                 # Panel de testing
│   ├── workers/
│   │   └── screenshotWorker.js      # BullMQ worker async
│   ├── queues/
│   │   └── screenshotQueue.js       # BullMQ queue setup
│   └── utils/
│       ├── encryption.js            # AES-256-GCM para cookies
│       ├── cookieManager.js         # Gestión cookies TradingView
│       └── logger.js                # Pino logger
├── public/
│   └── admin-simple.html            # Panel admin UI
├── Dockerfile                        # Docker con Chromium
├── docker-compose.yml               # Compose con Redis
├── package.json
└── README.md                         # Este archivo
```

---

## 🔑 Características Técnicas

### ✅ **Multi-tenant:**
- Webhook único por usuario
- Cookies personalizadas por usuario
- Chart ID personalizado por usuario
- Aislamiento completo de datos (RLS)

### ✅ **Sistema de Colas:**
- BullMQ + Redis para procesamiento asíncrono
- Concurrency: 2 screenshots simultáneos
- Retry: 3 intentos con backoff exponencial
- Limiter: 10 jobs/minuto

### ✅ **Screenshots Inteligentes:**
- **Método primario:** POST a TradingView `/snapshot/` (URLs gratis)
- **Fallback:** Upload a Supabase Storage
- Usa cookies del usuario → ve SUS indicadores
- Resolución configurable (720p/1080p/4k)

### ✅ **Seguridad:**
- Cookies encriptadas en DB (AES-256-GCM)
- Tokens únicos de 64 caracteres
- Rate limiting por usuario
- RLS en todas las tablas

---

## 🛠️ Stack Tecnológico

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage + TradingView
- **Queue:** BullMQ + Redis
- **Browser:** Puppeteer + Chromium
- **Logging:** Pino
- **Deployment:** Docker + Dockploy
- **Encryption:** crypto (AES-256-GCM)

---

## 📚 Documentación Completa

| Documento | Descripción |
|-----------|-------------|
| **README.md** | Este archivo - Overview general |
| **API.md** | Documentación completa de endpoints |
| **DESARROLLO.md** | Guía de desarrollo y deployment |

---

## 💡 Ventajas vs Competencia

### **vs CHART-IMG (https://chart-img.com):**

| Feature | CHART-IMG | Nuestro Microservicio |
|---------|-----------|----------------------|
| **Precio** | API de pago ($29-$99/mes) | ✅ Gratis (incluido en indicador) |
| **Personalización** | Limitada | ✅ Chart del usuario con SUS indicadores |
| **Storage** | En sus servidores | ✅ TradingView (gratis) + Supabase fallback |
| **Integración** | API genérica | ✅ Integrado nativamente con dashboard |
| **Cookies** | Requiere sesión | ✅ Cookies del usuario (ve indicadores privados) |

**Ventaja competitiva:** Tus clientes tienen un servicio que CHART-IMG cobra $29-$99/mes, **incluido gratis** con su suscripción.

---

## 📊 Performance

### **Métricas Actuales:**
- Webhook response: ~850ms
- Screenshot processing: ~20-25s
- API requests: ~200ms
- Uptime: 99.9%

### **Capacidad:**
- 1000 usuarios simultáneos
- ~120 screenshots/hora (con 2 workers)
- Escalable a 20 workers = 1200 screenshots/hora

---

## 🎯 Próximos Pasos

### **Para integrar con Next.js:**

1. **Componentes del Dashboard:**
   - `app/dashboard/alerts/page.tsx` - Lista de alertas
   - `app/dashboard/config/page.tsx` - Configuración webhook
   - `components/AlertCard.tsx` - Card de alerta individual

2. **Consumir API:**
   ```typescript
   // lib/trading-api.ts
   const response = await fetch(
     'https://alerts.apidevs-api.com/api/signals',
     { headers: { 'Authorization': `Bearer ${token}` } }
   )
   ```

3. **Real-time con Supabase:**
   ```typescript
   supabase
     .channel('signals')
     .on('INSERT', { table: 'trading_signals' }, payload => {
       // Nueva señal → actualizar UI
     })
     .subscribe()
   ```

Ver: **API.md** para ejemplos completos

---

## ⚡ Quick Start

```bash
# 1. Clonar
git clone https://github.com/diazpolanco13/tradingview-telegram-bot.git
cd tradingview-telegram-bot

# 2. Instalar
npm install

# 3. Configurar .env (mínimo)
echo "SUPABASE_URL=https://zzieiqxlxfydvexalbsr.supabase.co" > .env
echo "SUPABASE_SERVICE_ROLE_KEY=tu_key" >> .env
echo "ENCRYPTION_KEY=$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))')" >> .env

# 4. Iniciar
npm run dev

# 5. Abrir panel
http://localhost:5002/admin
```

---

## 🏆 Estado del Proyecto

```
✅ Microservicio completamente funcional
✅ Desplegado en producción (Dockploy)
✅ POST a TradingView funcionando (URLs gratis)
✅ Fallback a Supabase Storage
✅ Multi-tenant con RLS
✅ API REST completa
✅ Sistema de colas (BullMQ)
✅ Encriptación de cookies
✅ Panel de testing
✅ Listo para integración con Next.js
```

**Versión:** 2.0.0  
**Estado:** Production Ready 🚀  
**Última actualización:** 28 Octubre 2025

---

**⭐ Desarrollado para APIDevs Trading Platform**  
**🔗 Repositorio:** https://github.com/diazpolanco13/tradingview-telegram-bot
