# 📡 API Documentation - TradingView Alerts Microservice

> **Documentación completa de todos los endpoints disponibles**

**Base URL Producción:** `https://alerts.apidevs-api.com`  
**Base URL Local:** `http://localhost:5002`

---

## 📋 Índice

1. [Webhook Multi-tenant](#webhook-multi-tenant)
2. [Dashboard API](#dashboard-api)
3. [Admin Panel](#admin-panel)
4. [Health & Monitoring](#health--monitoring)
5. [Ejemplos de Integración](#ejemplos-de-integración)

---

## 🎯 Webhook Multi-tenant

### **POST `/webhook/:token`**

Endpoint principal que recibe alertas de TradingView.

**Autenticación:** Token único en URL (64 caracteres hex)

#### **Request:**

```http
POST /webhook/ab4d53d81831a3ae0f1a481258147004d37e8aedcfc269ed11a6838d3d9b81b6
Content-Type: application/json

{
  "indicator": "🐸 ADX DEF APIDEVS 👑",
  "ticker": "BINANCE:BTCUSDT",
  "exchange": "BINANCE",
  "symbol": "BTCUSDT",
  "price": 67890.50,
  "signal_type": "Divergencia Alcista 🟢",
  "direction": "LONG",
  "chart_id": "Q7w5R5x8",
  "interval": "15m",
  "message": "Señal detectada por el indicador"
}
```

#### **Campos del Body:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `indicator` | string | No | Nombre del indicador |
| `ticker` | string | Sí | Símbolo completo (ej: BINANCE:BTCUSDT) |
| `exchange` | string | No | Exchange (ej: BINANCE) |
| `symbol` | string | No | Símbolo sin exchange (ej: BTCUSDT) |
| `price` | number | Sí | Precio actual |
| `signal_type` | string | No | Tipo de señal (ej: "Divergencia Alcista") |
| `direction` | string | No | LONG / SHORT |
| `chart_id` | string | No | ID del chart en TradingView |
| `interval` | string | No | Timeframe (1m, 5m, 15m, 1h, 1D) |
| `message` | string | No | Mensaje adicional |

**Nota:** Si `chart_id` no se proporciona, usa el `default_chart_id` de la config del usuario.

#### **Response Exitoso (200 OK):**

```json
{
  "success": true,
  "message": "Señal recibida y procesada correctamente",
  "signal_id": "e952b5ba-b619-4170-b204-c0d69a0c484f",
  "screenshot_queued": true,
  "duration_ms": 847,
  "timestamp": "2025-10-28T02:19:30.683Z"
}
```

#### **Response Error:**

```json
{
  "success": false,
  "error": "Webhook token inválido, deshabilitado o cuota excedida"
}
```

**Códigos de Error:**
- `400` - Body inválido o ticker faltante
- `401` - Token inválido
- `403` - Webhook deshabilitado
- `429` - Cuota mensual excedida
- `500` - Error interno del servidor

---

### **Configurar en TradingView:**

```
URL del Webhook:
https://alerts.apidevs-api.com/webhook/TU_TOKEN_AQUI

Mensaje (JSON):
{
  "indicator": "{{strategy.order.comment}}",
  "ticker": "{{exchange}}:{{ticker}}",
  "exchange": "{{exchange}}",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "signal_type": "Divergencia Alcista",
  "direction": "LONG",
  "chart_id": "Q7w5R5x8"
}
```

---

## 📊 Dashboard API

Todos los endpoints requieren autenticación con JWT de Supabase.

### **Autenticación:**

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

El JWT se obtiene del login en Next.js:
```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

---

### **GET `/api/signals`**

Obtener lista de señales del usuario autenticado.

#### **Query Parameters:**

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Cantidad de señales |
| `offset` | number | 0 | Offset para paginación |
| `result` | string | all | Filtro: all/pending/win/loss/breakeven/skip |
| `ticker` | string | - | Filtrar por ticker específico |

#### **Request:**

```bash
GET /api/signals?limit=20&offset=0&result=win
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "ticker": "BINANCE:BTCUSDT",
      "price": 67890.50,
      "signal_type": "Divergencia Alcista 🟢",
      "direction": "LONG",
      "chart_id": "Q7w5R5x8",
      "screenshot_url": "https://www.tradingview.com/x/7r1wKX3R/",
      "screenshot_status": "completed",
      "result": "win",
      "profit_loss": 150.50,
      "created_at": "2025-10-28T02:45:05.171Z"
    }
  ],
  "count": 1,
  "total": 125
}
```

---

### **GET `/api/signals/:id`**

Obtener señal específica por ID.

#### **Request:**

```bash
GET /api/signals/e952b5ba-b619-4170-b204-c0d69a0c484f
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "data": {
    "id": "e952b5ba-b619-4170-b204-c0d69a0c484f",
    "ticker": "BINANCE:BTCUSDT",
    "price": 67890.50,
    "screenshot_url": "https://www.tradingview.com/x/7r1wKX3R/",
    "result": "pending",
    "created_at": "2025-10-28T02:45:05.171Z"
  }
}
```

---

### **PUT `/api/signals/:id`**

Actualizar resultado de una señal (marcar win/loss).

#### **Request:**

```bash
PUT /api/signals/e952b5ba-b619-4170-b204-c0d69a0c484f
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "result": "win",
  "entry_price": 67890.50,
  "exit_price": 68500.00,
  "profit_loss": 609.50,
  "profit_loss_percent": 0.898,
  "notes": "Take profit alcanzado en resistencia"
}
```

#### **Campos opcionales:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `result` | string | pending/win/loss/breakeven/skip |
| `entry_price` | number | Precio de entrada |
| `exit_price` | number | Precio de salida |
| `profit_loss` | number | Ganancia/pérdida en $ |
| `profit_loss_percent` | number | Ganancia/pérdida en % |
| `notes` | string | Notas del usuario |

#### **Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "result": "win",
    "profit_loss": 609.50,
    "updated_at": "2025-10-28T03:00:00.000Z"
  }
}
```

---

### **DELETE `/api/signals/:id`**

Eliminar una señal.

#### **Request:**

```bash
DELETE /api/signals/e952b5ba-b619-4170-b204-c0d69a0c484f
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "message": "Señal eliminada correctamente"
}
```

---

### **GET `/api/config`**

Obtener configuración del usuario autenticado.

#### **Request:**

```bash
GET /api/config
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "webhook_token": "ab4d53d81831a3ae...",
    "webhook_enabled": true,
    "webhook_requests_count": 127,
    "signals_quota": 500,
    "signals_used_this_month": 45,
    "default_chart_id": "Q7w5R5x8",
    "cookies_valid": true,
    "screenshot_resolution": "1080p",
    "preferred_timezone": "UTC",
    "created_at": "2025-09-10T00:00:00.000Z"
  }
}
```

---

### **PUT `/api/config`**

Actualizar configuración del usuario.

#### **Request:**

```bash
PUT /api/config
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "default_chart_id": "NewChartID",
  "screenshot_resolution": "4k",
  "tv_sessionid_plain": "rawzln0xokhx1k81oix8vhof6gkjxko6",
  "tv_sessionid_sign_plain": "v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys="
}
```

**Nota:** Las cookies se encriptan automáticamente antes de guardar.

#### **Campos opcionales:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `default_chart_id` | string | ID del chart por defecto |
| `screenshot_resolution` | string | 720p/1080p/4k |
| `webhook_enabled` | boolean | Habilitar/deshabilitar webhook |
| `tv_sessionid_plain` | string | Cookie sessionid (se encripta) |
| `tv_sessionid_sign_plain` | string | Cookie sessionid_sign (se encripta) |
| `preferred_timezone` | string | Timezone (ej: America/New_York) |

#### **Response:**

```json
{
  "success": true,
  "message": "Configuración actualizada correctamente",
  "cookies_encrypted": true
}
```

---

### **GET `/api/stats`**

Obtener estadísticas del usuario.

#### **Request:**

```bash
GET /api/stats
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "data": {
    "total_signals": 125,
    "total_screenshots": 98,
    "total_wins": 75,
    "total_losses": 40,
    "total_breakeven": 10,
    "win_rate": 65.22,
    "total_pnl": 2450.75,
    "avg_profit_per_win": 48.50,
    "avg_loss_per_loss": -25.30,
    "profit_factor": 1.92,
    "current_streak": 3,
    "max_win_streak": 8,
    "last_signal_at": "2025-10-28T02:45:00.000Z"
  }
}
```

---

## 🏥 Health & Monitoring

### **GET `/health`**

Health check del microservicio.

#### **Request:**

```bash
GET /health
```

#### **Response:**

```json
{
  "status": "healthy",
  "uptime": 31.109538937,
  "timestamp": "2025-10-28T02:44:38.135Z",
  "services": {
    "supabase": true,
    "redis": true,
    "puppeteer": true,
    "queue": {
      "waiting": 0,
      "active": 0,
      "completed": 125,
      "failed": 3,
      "delayed": 0,
      "total": 128
    }
  }
}
```

**Interpretación:**
- `status`: healthy/unhealthy
- `uptime`: Segundos desde último restart
- `services.supabase`: Conexión a base de datos
- `services.redis`: Redis/BullMQ disponible
- `services.puppeteer`: Chromium inicializado
- `queue.waiting`: Screenshots en cola
- `queue.active`: Screenshots procesándose ahora
- `queue.completed`: Total completados desde inicio
- `queue.failed`: Total fallidos (se reintentan automáticamente)

---

### **GET `/`**

Endpoint raíz - información del servicio.

#### **Response:**

```json
{
  "message": "TradingView Microservice - Multi-tenant V2",
  "version": "2.0.0",
  "status": "running",
  "timestamp": "2025-10-28T02:31:57.603Z",
  "endpoints": {
    "health": "GET /health",
    "webhookV2": "POST /webhook/:token (MAIN - Multi-tenant)",
    "webhookV1": "POST /webhook (Legacy - Single user)",
    "dashboardApi": "GET /api/* (Dashboard endpoints)",
    "admin": "GET /admin (Admin panel)"
  },
  "features": [
    "Multi-tenant (usuarios independientes)",
    "Webhook único por usuario",
    "Almacenamiento en Supabase",
    "Colas asíncronas con BullMQ",
    "Screenshots personalizados por usuario",
    "API REST para dashboard Next.js"
  ]
}
```

---

## 🎛️ Admin Panel

### **GET `/admin`**

Panel de testing y monitoreo (HTML interface).

#### **Features:**

1. **System Health Check**
   - Estado de Supabase, Redis, Puppeteer
   - Queue statistics en tiempo real

2. **Webhook V2 Testing**
   - Form para enviar señales de prueba
   - Selector de usuario (por token)
   - Response en tiempo real

3. **Supabase Connection Test**
   - Test de conexión
   - Conteo de configuraciones

4. **User Config Management**
   - Listar usuarios configurados
   - Ver tokens y configuraciones

5. **Recent Signals**
   - Últimas 10 señales procesadas
   - Estado de screenshots
   - URLs generadas

6. **Encryption Testing**
   - Probar encriptación/desencriptación
   - Verificar cookies

---

## 💻 Ejemplos de Integración

### **1. Next.js Client Component:**

```typescript
// app/dashboard/alerts/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const MICROSERVICE_URL = 'https://alerts.apidevs-api.com'

export default function AlertsPage() {
  const [signals, setSignals] = useState([])
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadSignals()
  }, [])

  async function loadSignals() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(`${MICROSERVICE_URL}/api/signals?limit=50`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    })
    
    const result = await response.json()
    if (result.success) {
      setSignals(result.data)
    }
  }

  async function updateSignalResult(signalId: string, result: 'win' | 'loss') {
    const { data: { session } } = await supabase.auth.getSession()
    
    await fetch(`${MICROSERVICE_URL}/api/signals/${signalId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ result })
    })
    
    loadSignals() // Reload
  }

  return (
    <div className="space-y-4">
      <h1>Mis Alertas</h1>
      {signals.map(signal => (
        <div key={signal.id} className="border p-4 rounded-lg">
          <h3>{signal.ticker} - {signal.direction}</h3>
          <p>Precio: ${signal.price}</p>
          
          {signal.screenshot_url && (
            <img 
              src={signal.screenshot_url} 
              alt="Chart" 
              className="w-full rounded mt-2"
            />
          )}
          
          <div className="flex gap-2 mt-2">
            <button onClick={() => updateSignalResult(signal.id, 'win')}>
              ✅ Win
            </button>
            <button onClick={() => updateSignalResult(signal.id, 'loss')}>
              ❌ Loss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

### **2. Configuración de Webhook:**

```typescript
// app/dashboard/config/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const MICROSERVICE_URL = 'https://alerts.apidevs-api.com'

export default function ConfigPage() {
  const [config, setConfig] = useState(null)
  const [sessionid, setSessionid] = useState('')
  const [sessionidSign, setSessionidSign] = useState('')
  const [chartId, setChartId] = useState('')
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(`${MICROSERVICE_URL}/api/config`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    
    const result = await response.json()
    if (result.success) {
      setConfig(result.data)
      setChartId(result.data.default_chart_id || '')
    }
  }

  async function saveConfig() {
    const { data: { session } } = await supabase.auth.getSession()
    
    await fetch(`${MICROSERVICE_URL}/api/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        default_chart_id: chartId,
        tv_sessionid_plain: sessionid,
        tv_sessionid_sign_plain: sessionidSign
      })
    })
    
    alert('✅ Configuración guardada')
    loadConfig()
  }

  const webhookUrl = config 
    ? `${MICROSERVICE_URL}/webhook/${config.webhook_token}`
    : 'Cargando...'

  return (
    <div className="space-y-6">
      <h1>⚙️ Configuración</h1>
      
      {/* Webhook URL */}
      <section>
        <h2>🔗 Tu Webhook Personalizado</h2>
        <div className="bg-gray-900 p-4 rounded font-mono text-sm">
          {webhookUrl}
        </div>
        <button onClick={() => navigator.clipboard.writeText(webhookUrl)}>
          📋 Copiar Webhook
        </button>
      </section>

      {/* Cookies */}
      <section>
        <h2>🍪 Cookies de TradingView</h2>
        <p className="text-sm text-gray-500 mb-2">
          Necesarias para capturar screenshots con TUS indicadores
        </p>
        <input
          type="text"
          placeholder="sessionid"
          value={sessionid}
          onChange={e => setSessionid(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />
        <input
          type="text"
          placeholder="sessionid_sign"
          value={sessionidSign}
          onChange={e => setSessionidSign(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <div className="mt-2">
          Estado: {config?.cookies_valid ? '✅ Válidas' : '❌ No configuradas'}
        </div>
      </section>

      {/* Chart ID */}
      <section>
        <h2>📊 Chart ID</h2>
        <input
          type="text"
          placeholder="Q7w5R5x8"
          value={chartId}
          onChange={e => setChartId(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <p className="text-sm text-gray-500 mt-2">
          ID de tu chart con TUS indicadores configurados
        </p>
      </section>

      <button 
        onClick={saveConfig}
        className="bg-blue-600 text-white px-6 py-2 rounded"
      >
        💾 Guardar Configuración
      </button>
    </div>
  )
}
```

---

### **3. Real-time con Supabase:**

```typescript
// Hook para suscribirse a nuevas señales
import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function useRealtimeSignals(onNewSignal: (signal: any) => void) {
  const supabase = createClientComponentClient()

  useEffect(() => {
    const channel = supabase
      .channel('signals_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trading_signals',
      }, (payload) => {
        onNewSignal(payload.new)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trading_signals',
      }, (payload) => {
        // Screenshot completado
        if (payload.new.screenshot_status === 'completed') {
          onNewSignal(payload.new)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

// Uso:
function AlertsDashboard() {
  const [signals, setSignals] = useState([])

  useRealtimeSignals((newSignal) => {
    setSignals(prev => [newSignal, ...prev])
    // Mostrar notificación
    showNotification('🚨 Nueva señal capturada!')
  })

  return <SignalsList signals={signals} />
}
```

---

## 📝 Formato de Mensaje TradingView

### **Recomendado (JSON completo):**

```json
{
  "indicator": "{{strategy.order.comment}}",
  "ticker": "{{exchange}}:{{ticker}}",
  "exchange": "{{exchange}}",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "signal_type": "Tu tipo de señal",
  "direction": "LONG",
  "chart_id": "Q7w5R5x8",
  "interval": "{{interval}}",
  "message": "Señal detectada en {{timenow}}"
}
```

### **Mínimo requerido:**

```json
{
  "ticker": "{{exchange}}:{{ticker}}",
  "price": {{close}}
}
```

---

## 🔧 Testing con cURL

### **Test 1: Health Check**

```bash
curl https://alerts.apidevs-api.com/health
```

---

### **Test 2: Enviar Señal**

```bash
curl -X POST https://alerts.apidevs-api.com/webhook/TU_TOKEN_AQUI \
  -H "Content-Type: application/json" \
  -d '{
    "indicator": "🐸 ADX DEF APIDEVS 👑",
    "ticker": "BINANCE:BTCUSDT",
    "price": 67890.50,
    "signal_type": "Divergencia Alcista 🟢",
    "direction": "LONG",
    "chart_id": "Q7w5R5x8"
  }'
```

---

### **Test 3: Obtener Señales (requiere JWT)**

```bash
# 1. Obtener JWT desde Supabase
# 2. Usar en request:

curl https://alerts.apidevs-api.com/api/signals \
  -H "Authorization: Bearer TU_JWT_TOKEN_AQUI"
```

---

### **Test 4: Actualizar Config**

```bash
curl -X PUT https://alerts.apidevs-api.com/api/config \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_chart_id": "Q7w5R5x8",
    "tv_sessionid_plain": "tu_sessionid",
    "tv_sessionid_sign_plain": "tu_sessionid_sign"
  }'
```

---

## 🔒 Seguridad

### **Tokens de Webhook:**
- Generados automáticamente al crear usuario
- 64 caracteres hexadecimales
- Únicos e irrevocables
- Se pueden regenerar desde dashboard

### **Cookies Encriptadas:**
- Algoritmo: AES-256-GCM
- Salt único por usuario
- IV aleatorio por encriptación
- Nunca se exponen en API responses

### **Rate Limiting:**
- Por plan del usuario (100-1000 requests/mes)
- Configurable en `trading_signals_config.signals_quota`
- Se resetea automáticamente cada mes

### **RLS (Row Level Security):**
- Políticas automáticas en Supabase
- Usuarios solo acceden a SUS datos
- Service role bypasses RLS (microservicio)

---

## ⚠️ Límites y Cuotas

| Plan | Señales/mes | Screenshots | Resolución |
|------|-------------|-------------|------------|
| **Free** | 100 | ✅ | 720p |
| **Pro** | 500 | ✅ | 1080p |
| **Premium** | Ilimitado | ✅ | 4K |

**Nota:** Los límites se configuran en `trading_signals_config.signals_quota`

---

## 🐛 Códigos de Error

### **Webhook Endpoint:**

| Código | Error | Solución |
|--------|-------|----------|
| 400 | Body inválido | Verificar formato JSON |
| 401 | Token inválido | Verificar token en URL |
| 403 | Webhook deshabilitado | Habilitar en config |
| 429 | Cuota excedida | Actualizar plan o esperar próximo mes |
| 500 | Error interno | Contactar soporte |

### **Dashboard API:**

| Código | Error | Solución |
|--------|-------|----------|
| 401 | No autenticado | Incluir Bearer token |
| 403 | Acceso denegado | Verificar que el recurso sea tuyo |
| 404 | Señal no encontrada | Verificar ID |
| 422 | Datos inválidos | Verificar campos del body |

---

## 📊 Webhook Response Times

| Operación | Tiempo |
|-----------|--------|
| Validar token | < 50ms |
| Insertar en DB | < 100ms |
| Encolar screenshot | < 50ms |
| **Response total** | **< 1s** |
| Screenshot processing (async) | 20-25s |

---

## 🎯 Roadmap

### **Implementado:**
- ✅ Webhook multi-tenant
- ✅ POST directo a TradingView (URLs gratis)
- ✅ Fallback a Supabase Storage
- ✅ Sistema de colas (BullMQ)
- ✅ Encriptación de cookies
- ✅ API REST completa
- ✅ Panel de testing

### **Próximo:**
- [ ] Soporte para Layout ID de TradingView
- [ ] Pool de browsers keep-alive (API v3)
- [ ] Detección dinámica de carga
- [ ] WebSocket real-time para dashboard
- [ ] Analytics avanzados

---

## 📚 Documentación

| Archivo | Descripción |
|---------|-------------|
| **README.md** | Este archivo - Overview general |
| **API.md** | Este archivo - Documentación API completa |
| **DESARROLLO.md** | Guía de desarrollo y deployment |

---

## 🆘 Soporte

**Issues:** https://github.com/diazpolanco13/tradingview-telegram-bot/issues  
**Email:** soporte@apidevs.com  
**Documentación:** https://alerts.apidevs-api.com/admin

---

**Versión:** 2.0.0  
**Última actualización:** 28 Octubre 2025  
**Stack:** Node.js + Express + Supabase + BullMQ + Redis + Puppeteer + Docker

