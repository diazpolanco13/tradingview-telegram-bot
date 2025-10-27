# 🏗️ Arquitectura: Microservicio de Captura de Señales Trading

> **Documento de Arquitectura** - Microservicio para Plataforma APIDevs

---

## 🎯 **Objetivo**

Convertir el bot de Telegram en un **microservicio especializado** que:
- Actúa como puente entre TradingView y la plataforma APIDevs
- Recibe webhooks de alertas de múltiples usuarios
- Captura screenshots personalizados con indicadores del usuario
- Almacena señales en Supabase (base de datos principal)
- Procesa screenshots de forma asíncrona con colas
- Se integra nativamente con la plataforma Next.js existente

---

## 📊 **Modelo de Negocio APIDevs**

### **Estructura del Ecosistema:**
```
PLATAFORMA APIDEVS (Next.js + Supabase)
https://apidevs-react.vercel.app
├── 🛒 Venta de indicadores personalizados (Stripe)
├── 👤 Autenticación y usuarios (Supabase Auth)
├── 💳 Gestión de suscripciones (Stripe + Supabase)
├── 📊 Dashboard de señales (React/Next.js)
├── 📈 Analytics y estadísticas de trading
├── 🗄️ Base de datos PostgreSQL (Supabase)
└── 🖼️ Storage de screenshots (Supabase Storage)

MICROSERVICIO DE CAPTURA (Node.js + Express)
Este proyecto - Bot actual convertido
├── 📡 Webhook endpoint por usuario (/webhook/u/:token)
├── 📸 Captura de screenshots (Puppeteer)
├── ⚡ Sistema de colas (BullMQ + Redis)
├── 💾 Inserción en Supabase DB
├── 📤 Upload a Supabase Storage
└── 📱 Notificaciones Telegram (opcional)
```

### **Flujo Completo del Usuario:**
1. **Usuario compra indicador** en plataforma APIDevs
2. **Sistema genera webhook token único** y lo guarda en Supabase
3. **Usuario copia su webhook URL** del dashboard
4. **Usuario configura alerta en TradingView** con su webhook personalizado
5. **Alerta se dispara** → llega al microservicio
6. **Microservicio procesa:**
   - Valida token en Supabase
   - Extrae datos de la señal (ticker, precio, etc)
   - Inserta en tabla `signals` en Supabase
   - Encola screenshot en BullMQ
   - Responde 200 OK a TradingView (< 100ms)
7. **Worker captura screenshot** (20-25 seg en background):
   - Puppeteer con cookies del usuario
   - Upload a Supabase Storage
   - Actualiza registro en DB con URL
8. **Dashboard se actualiza automáticamente** (Supabase Realtime)
9. **Usuario ve señal + screenshot** en su dashboard personalizado

---

## 🏛️ **Arquitectura del Sistema**

### **Componentes Principales:**

```
┌─────────────────────────────────────────────────────────┐
│  PLATAFORMA APIDEVS (Vercel/Next.js)                    │
│  https://apidevs-react.vercel.app                       │
│                                                          │
│  Frontend:                                               │
│  - Dashboard de señales (React)                         │
│  - Configuración de webhooks                            │
│  - Analytics y estadísticas                             │
│  - Gestión de suscripciones                             │
│                                                          │
│  Backend:                                                │
│  - Next.js API Routes                                   │
│  - Supabase Client (directo desde frontend)             │
│  - Stripe integration                                   │
│  - Real-time subscriptions (Supabase Realtime)          │
└─────────────────────────────────────────────────────────┘
       ↑ Queries directas                ↑ Realtime updates
       │ Supabase Client               │ (nuevas señales)
       │                                 │
┌──────┴─────────────────────────────────┴─────────────────┐
│  SUPABASE (Fuente Única de Verdad)                       │
│                                                           │
│  PostgreSQL Database:                                     │
│  - auth.users (Supabase Auth integrado)                  │
│  - signals (señales con screenshots)                     │
│  - user_config (webhook tokens, cookies TV, config)      │
│  - subscriptions (planes activos Stripe)                 │
│                                                           │
│  Storage (Supabase Storage):                              │
│  - Bucket: screenshots (imágenes PNG)                    │
│  - CDN integrado                                         │
│  - URLs públicas automáticas                             │
│                                                           │
│  Realtime:                                                │
│  - Notificaciones automáticas a dashboard                │
│  - Sin polling, push-based                               │
│                                                           │
│  Row Level Security (RLS):                                │
│  - Usuario solo ve SUS señales                           │
│  - Políticas automáticas por auth.uid()                  │
└───────────────────────────────────────────────────────────┘
       ↑ INSERT signals              ↑ Validación tokens
       │ UPDATE screenshots          │ Consultas user_config
       │                              │
┌──────┴──────────────────────────────┴──────────────────────┐
│  MICROSERVICIO DE CAPTURA (Docker/VPS)                     │
│  Este proyecto convertido a multi-tenant                   │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │  API Gateway (Express)                   │              │
│  │  - Webhook: POST /webhook/u/:token       │              │
│  │  - Health check: GET /health             │              │
│  │  - Rate limiting por usuario             │              │
│  │  - Supabase Client (para DB/Storage)     │              │
│  │  - Response < 100ms garantizado          │              │
│  └──────────────────────────────────────────┘              │
│                    ↓                                        │
│  ┌──────────────────────────────────────────┐              │
│  │  Message Processor                       │              │
│  │  - Consulta Supabase: validar token     │              │
│  │  - Parsea mensaje TradingView            │              │
│  │  - Extrae ticker automáticamente         │              │
│  │  - INSERT en Supabase.signals            │              │
│  │  - Status: 'pending'                     │              │
│  └──────────────────────────────────────────┘              │
│                    ↓                                        │
│  ┌──────────────────────────────────────────┐              │
│  │  Screenshot Queue (BullMQ + Redis)       │              │
│  │  - Cola de jobs de captura               │              │
│  │  - Prioridad por plan Stripe             │              │
│  │  - Retry automático (3 intentos)         │              │
│  │  - Redis local o Redis Cloud             │              │
│  └──────────────────────────────────────────┘              │
│                    ↓                                        │
│  ┌──────────────────────────────────────────┐              │
│  │  Screenshot Workers Pool                 │              │
│  │  - Puppeteer con cookies del usuario     │              │
│  │  - Concurrency: 2-3 por worker           │              │
│  │  - 5-10 workers iniciales                │              │
│  │  - Auto-scale hasta 20 workers           │              │
│  │  - Upload directo a Supabase Storage     │              │
│  │  - UPDATE Supabase.signals (status+url)  │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                    ↑ Webhooks
┌─────────────────────────────────────────────────────────────┐
│  TRADINGVIEW                                                │
│  Usuario configura alerta con su webhook personalizado:    │
│  https://bot.apidevs.com/webhook/u/abc123?chart=Q7w5R5x8   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 **Sistema Multi-Tenant con Supabase**

### **Individualización por Usuario:**

Cada usuario de APIDevs tiene:
- **Cuenta en Supabase Auth:** Autenticación segura integrada
- **Webhook token único:** `https://bot.apidevs.com/webhook/u/abc123def456...`
- **Cookies propias de TradingView:** Almacenadas encriptadas en `user_config`
- **Chart ID personalizado:** Donde tiene configurados SUS indicadores
- **Plan de suscripción:** Free/Pro/Premium (validado vía Stripe en Supabase)
- **Aislamiento de datos:** RLS garantiza que solo ve SUS señales

### **Flujo Detallado de una Alerta:**

#### **1. Usuario configura en TradingView:**
```
Webhook URL: https://bot.apidevs.com/webhook/u/abc123def456?chart=Q7w5R5x8
Message: 
🪙 Ticker: BINANCE:BTCUSDT
💰 Precio: $67,890.50
📈 Cambio: +2.5%
⏰ {{timenow}}
```

#### **2. Alerta se dispara → Microservicio recibe:**
```http
POST /webhook/u/abc123def456?chart=Q7w5R5x8
Content-Type: text/plain

🪙 Ticker: BINANCE:BTCUSDT
💰 Precio: $67,890.50
📈 Cambio: +2.5%
⏰ 2025-10-27 14:30:00
```

#### **3. Microservicio valida token en Supabase (< 50ms):**
```javascript
const { data: config, error } = await supabase
  .from('user_config')
  .select(`
    user_id,
    default_chart_id,
    tv_sessionid,
    tv_sessionid_sign,
    cookies_valid,
    users!inner(subscription_plan)
  `)
  .eq('webhook_token', token)
  .eq('cookies_valid', true)
  .single();

// Valida límites según plan
if (config.users.subscription_plan === 'free' && 
    monthlySignals >= 50) {
  return res.status(429).json({ 
    error: 'Límite alcanzado. Actualiza tu plan.' 
  });
}
```

#### **4. Parseo y extracción de datos (< 20ms):**
```javascript
const ticker = extractTicker(message); // "BINANCE:BTCUSDT"
const price = extractPrice(message);   // 67890.50
const timestamp = new Date();
```

#### **5. Inserción en Supabase (< 30ms):**
```javascript
const { data: signal } = await supabase
  .from('signals')
  .insert({
    user_id: config.user_id,
    ticker: ticker,
    exchange: 'BINANCE',
    symbol: 'BTCUSDT',
    price: price,
    chart_id: chartId,
    raw_message: message,
    screenshot_status: 'pending',
    timestamp: timestamp,
    result: 'pending'
  })
  .select()
  .single();
```

#### **6. Encolar screenshot + Responder (< 100ms total):**
```javascript
await screenshotQueue.add('capture', {
  signal_id: signal.id,
  user_id: config.user_id,
  chart_id: chartId,
  ticker: ticker,
  cookies: {
    sessionid: config.tv_sessionid,
    sessionid_sign: config.tv_sessionid_sign
  }
});

res.json({
  success: true,
  signal_id: signal.id,
  status: 'processing'
});
```

#### **7. Worker procesa screenshot en background (20-25 seg):**
```javascript
// Worker toma el job
screenshotWorker.process(async (job) => {
  const { signal_id, chart_id, ticker, cookies } = job.data;
  
  // Captura con Puppeteer
  const screenshot = await captureChart(chart_id, ticker, cookies);
  
  // Upload a Supabase Storage
  const { data: upload } = await supabase.storage
    .from('screenshots')
    .upload(`${signal_id}.png`, screenshot, {
      contentType: 'image/png',
      cacheControl: '3600'
    });
  
  // Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(`${signal_id}.png`);
  
  // Actualizar señal en DB
  await supabase
    .from('signals')
    .update({
      screenshot_url: publicUrl,
      screenshot_status: 'completed'
    })
    .eq('id', signal_id);
});
```

#### **8. Dashboard se actualiza automáticamente:**
```javascript
// En el frontend Next.js
const signalsSubscription = supabase
  .channel('signals_changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Nueva señal → Actualizar UI
    setSignals(prev => [payload.new, ...prev]);
    showNotification('Nueva señal capturada!');
  })
  .subscribe();
```

---

## 🗄️ **Modelo de Datos en Supabase**

### **Tabla: `signals`** (Señales capturadas)
```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Datos del indicador
  indicator_name VARCHAR(100),              -- "ADX DEF [APIDEVS]"
  ticker VARCHAR(50) NOT NULL,              -- "BINANCE:BTCUSDT"
  exchange VARCHAR(20),                     -- "BINANCE"
  symbol VARCHAR(20),                       -- "BTCUSDT"
  
  -- Datos de precio
  price DECIMAL(18, 8),                     -- 67890.50
  signal_type VARCHAR(50),                  -- "Divergencia Alcista"
  
  -- Screenshot
  chart_id VARCHAR(20),                     -- "Q7w5R5x8"
  screenshot_url TEXT,                      -- URL de Supabase Storage
  screenshot_status VARCHAR(20) DEFAULT 'pending', -- pending/processing/completed/failed
  
  -- Metadata
  raw_message TEXT,                         -- Mensaje completo de TradingView
  timestamp TIMESTAMPTZ NOT NULL,           -- Cuándo se disparó la alerta
  
  -- Tracking de resultado (usuario edita)
  result VARCHAR(20) DEFAULT 'pending',     -- pending/win/loss/skip
  profit_loss DECIMAL(10, 2),               -- +150.00 o -50.00
  notes TEXT,                               -- Notas del usuario
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_signals_user_id ON signals(user_id);
CREATE INDEX idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX idx_signals_ticker ON signals(ticker);
CREATE INDEX idx_signals_result ON signals(result);
CREATE INDEX idx_signals_status ON signals(screenshot_status);

-- Row Level Security (RLS)
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Policy: Usuario solo ve SUS señales
CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Usuario solo edita SUS señales
CREATE POLICY "Users can update own signals"
  ON signals FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Microservicio puede insertar (service_role key)
CREATE POLICY "Service can insert signals"
  ON signals FOR INSERT
  WITH CHECK (true);
```

### **Tabla: `user_config`** (Configuración por usuario)
```sql
CREATE TABLE user_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Webhook
  webhook_token VARCHAR(100) UNIQUE NOT NULL,  -- Token único para webhook
  webhook_enabled BOOLEAN DEFAULT true,
  webhook_last_used TIMESTAMPTZ,
  
  -- TradingView
  default_chart_id VARCHAR(20),                -- Chart ID por defecto
  tv_sessionid TEXT,                           -- Cookie 1 (encriptada)
  tv_sessionid_sign TEXT,                      -- Cookie 2 (encriptada)
  cookies_valid BOOLEAN DEFAULT false,
  cookies_updated_at TIMESTAMPTZ,
  
  -- Notificaciones
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_chat_id VARCHAR(50),
  email_enabled BOOLEAN DEFAULT true,
  
  -- Configuración
  preferences JSONB DEFAULT '{}',              -- Preferencias personalizadas
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda rápida por token
CREATE INDEX idx_user_config_webhook_token ON user_config(webhook_token);

-- RLS
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config"
  ON user_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON user_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Microservicio lee config (para validar webhooks)
CREATE POLICY "Service can read config"
  ON user_config FOR SELECT
  USING (true);
```

### **Tabla: `subscriptions`** (Planes de suscripción)
```sql
-- Esta tabla ya existe en tu plataforma APIDevs
-- Solo añadimos columnas relevantes para señales

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS 
  signals_quota INTEGER DEFAULT 50;          -- Límite mensual de señales

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS 
  signals_used INTEGER DEFAULT 0;            -- Señales usadas este mes

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS 
  quota_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
```

### **Storage Bucket: `screenshots`**
```sql
-- Crear bucket público en Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

-- Policy: Solo microservicio puede subir (service_role)
CREATE POLICY "Service can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots');

-- Policy: Usuarios autenticados pueden ver screenshots
CREATE POLICY "Authenticated users can view screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots' AND auth.role() = 'authenticated');
```

---

## 🔄 **Sistema de Colas**

### **Filosofía:**
- **API response ultra-rápido:** Guarda señal en DB, responde inmediatamente
- **Screenshots procesados en background:** No bloquea la API
- **Prioridad por plan:** Premium procesa antes que free

### **Configuración de Cola:**
```
Queue: screenshot-processing
├── Concurrency: 3 screenshots por worker
├── Workers iniciales: 10
├── Auto-scale hasta: 20 workers
├── Timeout por job: 30 segundos
├── Retry: 3 intentos
└── Backoff: Exponencial (2s, 4s, 8s)
```

### **Prioridades:**
- 1: Premium (procesa primero)
- 2: Pro
- 3: Basic
- 4: Free

---

## 📡 **API Endpoints**

### **Webhook (Principal)**
```
POST /webhook/u/:token
Query: ?chart=CHART_ID
Body: Mensaje de alerta

Response < 100ms:
{
  "success": true,
  "signal_id": "uuid",
  "screenshot_status": "processing",
  "estimated_wait": 25
}
```

### **Health Check**
```
GET /health
Response:
{
  "status": "healthy",
  "queue_length": 45,
  "active_workers": 10,
  "uptime": 123456
}
```

### **Estadísticas (para plataforma web)**
```
GET /api/users/:id/stats
Auth: Bearer token
Response:
{
  "total_signals": 1247,
  "this_month": 127,
  "screenshots_pending": 3,
  "win_rate": 68.5
}
```

---

## 🚀 **Despliegue**

### **Infraestructura:**
- **Contenedores:** Docker
- **Orquestación:** Kubernetes o Docker Compose
- **Load Balancer:** NGINX/Traefik
- **Base de datos:** PostgreSQL (managed)
- **Cache/Colas:** Redis (managed)
- **Storage:** Cloudflare R2 o AWS S3
- **CDN:** Cloudflare

### **Escalado:**
- **Horizontal:** Más réplicas de API
- **Workers:** Auto-scaling según cola
- **Database:** Read replicas
- **Storage:** CDN global

---

## 🔐 **Seguridad**

### **Por token de webhook:**
- Token único e irrevocable por usuario
- Rate limiting por usuario
- Validación de formato estandarizado
- Auditoría de todas las llamadas

### **Datos sensibles:**
- Cookies de TradingView encriptadas en DB
- Tokens rotables
- Audit logs completos
- IP whitelist opcional

---

## 📊 **Monitoreo y Observabilidad**

### **Métricas clave:**
- Webhooks recibidos/minuto
- Tiempo de respuesta API (< 100ms target)
- Longitud de cola de screenshots
- Workers activos
- Tasa de éxito de screenshots
- Uso de storage

### **Alertas:**
- Cola > 200 jobs
- API response time > 500ms
- Screenshot failure rate > 10%
- Base de datos lenta

---

## 🎯 **Capacidad del Sistema**

### **Configuración inicial (1000 usuarios):**
```
API Instances: 3
Screenshot Workers: 10-20 (auto-scale)
Concurrency: 3 por worker
Capacidad: ~90 screenshots/minuto
```

### **En picos:**
- Sistema detecta cola > 100
- Auto-escala a 20 workers
- Procesa 60 screenshots simultáneos
- Recuperación en 10-15 minutos

---

## 🔄 **Integración con Plataforma Web**

### **Flujo de consumo:**

1. **Usuario entra a dashboard:**
   - Frontend hace: `GET /api/signals?user_id=abc`

2. **API interna consulta microservicio:**
   ```
   GET https://alertas.api.apidevs.com/api/users/abc/signals
   ```

3. **Microservicio consulta DB:**
   ```sql
   SELECT * FROM signals 
   WHERE user_id = 'abc' 
   ORDER BY created_at DESC
   ```

4. **Frontend muestra:**
   - Tabla de señales
   - Screenshots inline
   - Filtros y búsqueda

### **WebSockets (opcional):**
```
Usuario conectado → WebSocket activo
Nueva señal → Push notification real-time
Actualizar UI automáticamente
```

---

## 🎨 **Ventajas de esta Arquitectura**

### **Escalabilidad:**
- API independiente de workers
- Workers escalan independientemente
- Base de datos compartida pero indexada
- Storage en CDN global

### **Mantenibilidad:**
- Código del bot reutilizable
- Agregar nuevos indicadores = solo config
- Tests unitarios por componente
- Deploy independiente

### **Performance:**
- Response API < 100ms
- Screenshots en background
- Cache de imágenes en CDN
- Queries optimizadas con índices

### **Reliability:**
- Retry automático en fallos
- Workers se reinician solos
- Backup automático de DB
- Monitoring 24/7

---

## 🚀 **Fases de Implementación**

### **Fase 1: Migración (Semana 1-2)**
- Extraer lógica del bot actual
- Crear API REST
- Base de datos multi-tenant
- Deploy en producción

### **Fase 2: Sistema de colas (Semana 3)**
- Implementar BullMQ + Redis
- Workers de screenshots
- Prioridades por plan
- Auto-scaling

### **Fase 3: Integración (Semana 4)**
- Consumir desde plataforma web
- Dashboard de señales
- Filtros y búsqueda
- Estadísticas básicas

### **Fase 4: Optimización (Mes 2)**
- CDN para screenshots
- Cache de queries frecuentes
- WebSockets real-time
- Analytics avanzados

---

## 💡 **Consideraciones Técnicas**

### **Límite de conecciones de Puppeteer:**
- Chromium es pesado (200MB RAM)
- Pool de browsers reutilizables
- Timeout agresivo (30s)
- Cleanup automático

### **Cookies por usuario:**
- Cada screenshot usa cookies del usuario
- Las cookies se guardan por usuario
- Validación periódica de validez
- Renovación manual

### **Formato de mensaje:**
- Estándar definido por indicadores
- Parseo robusto con validación
- Logs de errores para debugging
- Fallback graceful

---

## 📋 **Checklist Técnico**

- [ ] Extraer código actual en clases reutilizables
- [ ] Crear API REST con Express
- [ ] Diseñar modelo de base de datos
- [ ] Implementar autenticación por token
- [ ] Sistema de colas con BullMQ
- [ ] Workers de screenshots
- [ ] Storage en S3/R2
- [ ] Integración con plataforma web
- [ ] Monitoring y alertas
- [ ] Tests unitarios
- [ ] Documentación de API

---

---

## 🎯 **Ventajas de esta Arquitectura para APIDevs**

### **1. Supabase como Fuente Única de Verdad:**
- ✅ Una sola base de datos para TODO
- ✅ Sin sincronización entre sistemas
- ✅ RLS automático = seguridad robusta
- ✅ Realtime = UX moderna sin esfuerzo
- ✅ Storage integrado = menos infraestructura

### **2. Microservicio Stateless:**
- ✅ Solo procesa webhooks
- ✅ No almacena nada localmente
- ✅ Fácil de escalar horizontalmente
- ✅ Reinicio sin pérdida de datos

### **3. Integración Nativa con Next.js:**
- ✅ Frontend consulta Supabase directamente
- ✅ Sin necesidad de API intermedia
- ✅ Queries optimizadas con filtros
- ✅ TypeScript types generados automáticamente

### **4. Bajo Costo Operacional:**
```
Supabase Free Tier:
- 500MB DB (suficiente para 10,000+ señales)
- 1GB Storage (2,000+ screenshots)
- 2GB bandwidth/mes
→ $0/mes

Supabase Pro (cuando crezcas):
- 8GB DB
- 100GB Storage
- 50GB bandwidth
→ $25/mes

VPS para Microservicio:
- 2GB RAM, 1 vCPU
- Hetzner/DigitalOcean
→ $5-10/mes

Redis Cloud Free:
- 30MB (suficiente para colas)
→ $0/mes

TOTAL: $5-10/mes inicial, $35/mes cuando crezcas
```

### **5. Tiempo de Desarrollo Reducido:**
- ✅ MCP Supabase = gestión DB desde Cursor
- ✅ No necesitas crear APIs CRUD
- ✅ Auth ya resuelto (Supabase Auth)
- ✅ Storage ya resuelto (Supabase Storage)
- ✅ Realtime ya resuelto (Supabase Realtime)

**Estimado:** MVP funcional en 2-3 semanas vs 2-3 meses con arquitectura tradicional.

---

## 📋 **Roadmap de Implementación APIDevs**

### **Fase 1: Fundamentos (Semana 1-2)**
- [ ] Crear tablas en Supabase (`signals`, `user_config`)
- [ ] Generar migración SQL
- [ ] Implementar RLS policies
- [ ] Crear bucket `screenshots` en Storage
- [ ] Modificar bot: endpoint `/webhook/u/:token`
- [ ] Integrar Supabase SDK en microservicio
- [ ] Test básico: webhook → DB → Storage

### **Fase 2: Dashboard Next.js (Semana 3)**
- [ ] Página `/dashboard/signals` en Next.js
- [ ] Query signals del usuario logueado
- [ ] Mostrar tabla con filtros (fecha, ticker, resultado)
- [ ] Modal para ver screenshot completo
- [ ] Editar resultado (win/loss/profit)
- [ ] Supabase Realtime para nuevas señales

### **Fase 3: Colas y Escalado (Semana 4)**
- [ ] Instalar BullMQ + Redis
- [ ] Implementar cola `screenshot-processing`
- [ ] Workers en background
- [ ] Monitoreo de cola (dashboard admin)
- [ ] Auto-retry en fallos

### **Fase 4: Features Avanzadas (Mes 2)**
- [ ] Analytics: win rate, profit/loss total
- [ ] Gráficos con Chart.js/Recharts
- [ ] Exportar a CSV/Excel
- [ ] Notificaciones Telegram opcionales
- [ ] Multi-chart support

### **Fase 5: Optimización (Mes 3)**
- [ ] Cache de queries frecuentes
- [ ] Índices optimizados
- [ ] CDN para screenshots
- [ ] Cleanup automático (screenshots >90 días)
- [ ] Monitoring con Sentry

---

## 🚀 **Próximos Pasos Inmediatos**

### **1. Preparar Supabase:**
```bash
# Conectar con MCP Supabase desde Cursor
# Ejecutar migraciones SQL (crear tablas)
# Crear bucket screenshots
# Configurar RLS policies
```

### **2. Modificar Bot Actual:**
```javascript
// Instalar Supabase SDK
npm install @supabase/supabase-js

// Cambiar endpoint a /webhook/u/:token
// Integrar validación de token en Supabase
// Insertar señales en DB
// Upload screenshots a Storage
```

### **3. Crear Dashboard en Next.js:**
```bash
# Ya tienes la plataforma, solo agregar página
# app/dashboard/signals/page.tsx
# Componentes: SignalsTable, SignalFilters, SignalModal
```

---

**Este microservicio será el corazón del sistema de captura de señales de APIDevs, integrándose perfectamente con tu plataforma Next.js existente y escalando a miles de usuarios con Supabase.**

**Versión:** 2.0 - Arquitectura Supabase
**Última actualización:** Octubre 2025  
**Estado:** Listo para implementación

