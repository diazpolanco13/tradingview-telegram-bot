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
  "default_chart_id": "Q7w5R5x8",
  "screenshot_resolution": "1080p",
  "tv_sessionid_plain": "rawzln0xokhx1k81oix8vhof6gkjxko6",
  "tv_sessionid_sign_plain": "v3:5NvaK1e30zMd0x3ZsfXfdd2qjN/QU+RvylXt92x6Mys=",
  "telegram_enabled": true,
  "telegram_bot_token": "8257215317:AAGvfmsjEx_IP4Oh-lb-ETYfyCs4W8ibmsE",
  "telegram_chat_id": "123456789"
}
```

**Nota:** Las cookies TradingView se encriptan automáticamente antes de guardar.

#### **Campos opcionales:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `default_chart_id` | string | ID del chart por defecto |
| `screenshot_resolution` | string | 720p/1080p/4k |
| `webhook_enabled` | boolean | Habilitar/deshabilitar webhook |
| `tv_sessionid_plain` | string | Cookie sessionid (se encripta) |
| `tv_sessionid_sign_plain` | string | Cookie sessionid_sign (se encripta) |
| `preferred_timezone` | string | Timezone (ej: America/New_York) |
| `telegram_enabled` | boolean | **Habilitar notificaciones Telegram** |
| `telegram_bot_token` | string | **Token del bot (de @BotFather)** |
| `telegram_chat_id` | string | **Chat ID o Canal ID** |

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

### **GET `/api/quota`** ⭐ NUEVO

Obtener información de cuota del usuario autenticado (para mostrar en dashboard).

#### **Request:**

```bash
GET /api/quota
Authorization: Bearer {jwt_token}
```

#### **Response:**

```json
{
  "success": true,
  "quota": {
    "total": 500,
    "used": 234,
    "remaining": 266,
    "total_text": "500",
    "remaining_text": "266",
    "percentage": 46,
    "percentage_text": "46%",
    "status": "OK",
    "status_color": "green",
    "warning": null,
    "can_receive_signals": true,
    "is_unlimited": false,
    "user_id": "uuid-here"
  }
}
```

#### **Estados posibles:**

| Status | Color | Condición |
|--------|-------|-----------|
| `OK` | green | < 75% usado |
| `ADVERTENCIA` | yellow | 75-89% usado |
| `CRÍTICO` | orange | 90-99% usado |
| `EXCEDIDO` | red | 100% usado |
| `ILIMITADO` | blue | Cuota ilimitada (-1) |

#### **Uso en React/Next.js:**

```typescript
// Hook para obtener cuota
async function loadQuota() {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch('https://alerts.apidevs-api.com/api/quota', {
    headers: { 'Authorization': `Bearer ${session?.access_token}` }
  })
  
  const result = await response.json()
  return result.quota
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

### **2. Configuración Completa (con Telegram):**

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
  
  // Telegram
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  
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
      setTelegramEnabled(result.data.telegram_enabled || false)
      setTelegramChatId(result.data.telegram_chat_id || '')
      // Token no se devuelve por seguridad
    }
  }

  async function saveConfig() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const payload = {
      default_chart_id: chartId,
      telegram_enabled: telegramEnabled
    }
    
    // Solo enviar cookies si están llenas
    if (sessionid && sessionidSign) {
      payload.tv_sessionid_plain = sessionid
      payload.tv_sessionid_sign_plain = sessionidSign
    }
    
    // Solo enviar Telegram si está habilitado y hay datos
    if (telegramEnabled && telegramToken && telegramChatId) {
      payload.telegram_bot_token = telegramToken
      payload.telegram_chat_id = telegramChatId
    }
    
    await fetch(`${MICROSERVICE_URL}/api/config`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    alert('✅ Configuración guardada')
    loadConfig()
  }

  const webhookUrl = config 
    ? `${MICROSERVICE_URL}/webhook/${config.webhook_token}`
    : 'Cargando...'

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold">⚙️ Configuración</h1>
      
      {/* Webhook URL */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">🔗 Tu Webhook Personalizado</h2>
        <div className="bg-gray-900 p-4 rounded font-mono text-sm break-all text-green-400">
          {webhookUrl}
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(webhookUrl)
            alert('✅ Webhook copiado al portapapeles')
          }}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📋 Copiar Webhook
        </button>
        <p className="text-sm text-gray-500 mt-3">
          Usa esta URL en tus alertas de TradingView
        </p>
      </section>

      {/* Cookies TradingView */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">🍪 Cookies de TradingView</h2>
        <p className="text-sm text-gray-500 mb-4">
          Necesarias para capturar screenshots con TUS indicadores personalizados
        </p>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">sessionid:</label>
            <input
              type="password"
              placeholder="sessionid (32 caracteres)"
              value={sessionid}
              onChange={e => setSessionid(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">sessionid_sign:</label>
            <input
              type="password"
              placeholder="sessionid_sign (47 caracteres)"
              value={sessionidSign}
              onChange={e => setSessionidSign(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm">Estado:</span>
          {config?.cookies_valid ? (
            <span className="text-green-600 font-semibold">✅ Cookies válidas</span>
          ) : (
            <span className="text-red-600 font-semibold">❌ No configuradas</span>
          )}
        </div>
        
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
            📖 ¿Cómo obtener las cookies?
          </summary>
          <div className="mt-2 text-sm text-gray-600 space-y-2 pl-4">
            <p>1. Abre TradingView y loguéate</p>
            <p>2. Presiona <kbd>F12</kbd> (DevTools)</p>
            <p>3. Ve a <strong>Application</strong> → <strong>Cookies</strong> → <code>tradingview.com</code></p>
            <p>4. Copia <code>sessionid</code> y <code>sessionid_sign</code></p>
            <p>5. Pega aquí y guarda</p>
          </div>
        </details>
      </section>

      {/* Chart ID */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">📊 Chart ID</h2>
        <input
          type="text"
          placeholder="Q7w5R5x8"
          value={chartId}
          onChange={e => setChartId(e.target.value)}
          className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono"
        />
        <p className="text-sm text-gray-500 mt-2">
          ID de tu chart en TradingView con TUS indicadores configurados
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
            📖 ¿Cómo obtener mi Chart ID?
          </summary>
          <div className="mt-2 text-sm text-gray-600 space-y-2 pl-4">
            <p>1. Abre tu chart en TradingView</p>
            <p>2. Agrega tus indicadores favoritos</p>
            <p>3. Click en <strong>Share</strong> (compartir)</p>
            <p>4. Copia el ID de la URL: <code>https://www.tradingview.com/chart/Q7w5R5x8/</code></p>
            <p>5. El ID es: <code>Q7w5R5x8</code></p>
          </div>
        </details>
      </section>

      {/* Telegram Configuration */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">📱 Notificaciones a Telegram (Opcional)</h2>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Ventaja:</strong> Recibe alertas en tu móvil, reloj o tablet. 
            Telegram es multi-dispositivo y funciona donde estés.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="telegram-enabled"
              checked={telegramEnabled}
              onChange={e => setTelegramEnabled(e.target.checked)}
              className="w-5 h-5"
            />
            <label htmlFor="telegram-enabled" className="font-medium">
              Habilitar notificaciones a Telegram
            </label>
          </div>
          
          {telegramEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Token del Bot:</label>
                <input
                  type="password"
                  placeholder="8257215317:AAGvfmsjEx_IP4Oh-lb-ETYfyCs4W8ibmsE"
                  value={telegramToken}
                  onChange={e => setTelegramToken(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Obtén este token de @BotFather en Telegram
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Chat ID:</label>
                <input
                  type="text"
                  placeholder="123456789 o -1001234567890 (canal)"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tu ID de chat personal o de canal
                </p>
              </div>
            </>
          )}
        </div>
        
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
            📖 Tutorial Completo: Cómo configurar Telegram
          </summary>
          <div className="mt-4 space-y-4 text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded">
            <div>
              <h4 className="font-bold mb-2">Paso 1: Crear tu Bot</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Abre Telegram y busca <strong>@BotFather</strong></li>
                <li>Envía el comando: <code>/newbot</code></li>
                <li>Nombre del bot: "Mis Alertas de Trading"</li>
                <li>Username: <code>tu_usuario_alertas_bot</code></li>
                <li>BotFather te dará un <strong>TOKEN</strong> → Cópialo</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">Paso 2: Obtener Chat ID</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                <strong>Para chat privado:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Busca tu bot en Telegram</li>
                <li>Envíale: <code>/start</code></li>
                <li>Abre: <code>https://api.telegram.org/bot{'{TOKEN}'}/getUpdates</code></li>
                <li>Busca: <code>"chat":{'{'}"{id}": 123456789{'}'}</code></li>
                <li>Ese número es tu Chat ID</li>
              </ol>
              
              <p className="text-gray-600 dark:text-gray-400 mt-3 mb-2">
                <strong>Para canal:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Crea un canal en Telegram</li>
                <li>Agrega tu bot como administrador</li>
                <li>Envía un mensaje al canal</li>
                <li>Usa el mismo enlace getUpdates</li>
                <li>El Chat ID será negativo: <code>-1001234567890</code></li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">Paso 3: Guardar Aquí</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Pega el Token y Chat ID en los campos de arriba y haz click en "Guardar Configuración"
              </p>
            </div>
          </div>
        </details>
      </section>

      <button 
        onClick={saveConfig}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold text-lg"
      >
        💾 Guardar Configuración
      </button>
      
      <div className="text-sm text-gray-500 text-center">
        Las cookies se encriptan automáticamente antes de guardarse
      </div>
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

| Plan | Señales/mes | ~Diario | Screenshots | Resolución | Use Case |
|------|-------------|---------|-------------|------------|----------|
| **Free** | 1,000 | ~33/día | ✅ | 1080p | 2 gráficos, alertas cada 1h |
| **Pro** | 15,000 | ~500/día | ✅ | 1080p | 10 gráficos, alertas cada 15min |
| **Lifetime** | Ilimitado | ∞ | ✅ | 4K | Sin límites - Acceso VIP |

**Nota:** Los límites se configuran en `trading_signals_config.signals_quota`

**Cuotas diseñadas para traders activos:** Los planes están calculados para uso real de múltiples gráficos con alertas frecuentes, no solo 1-2 señales al día.

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

## 📱 Telegram Notifications

### **Configuración:**

Cada usuario puede habilitar notificaciones a **SU PROPIO bot de Telegram**.

**Campos en `trading_signals_config`:**
```sql
telegram_enabled     boolean   # ON/OFF
telegram_bot_token   varchar   # Token de @BotFather
telegram_chat_id     varchar   # Chat ID del usuario
```

---

### **Formato de Mensaje Enviado:**

```markdown
🚨 *Nueva Señal de Trading*

🪙 *Ticker:* BINANCE:BTCUSDT
💰 *Precio:* $68,234.50
📊 *Señal:* Divergencia Alcista 🟢
📈 *Dirección:* LONG
🔧 *Indicador:* 🐸 ADX DEF APIDEVS 👑

⏰ 28/10/2025, 3:48:48

📸 [Ver Screenshot en TradingView](https://www.tradingview.com/x/UdQmiPpP/)

_Señal #3531d33b_
```

**Características:**
- ✅ Parse mode: Markdown
- ✅ Preview del screenshot habilitado
- ✅ Link clickeable
- ✅ Timezone del usuario (configurable)
- ✅ Emojis para mejor visualización

---

### **Cuándo se Envía:**

El mensaje de Telegram se envía **DESPUÉS** de completar el screenshot (~25 segundos):

```
1. Webhook recibe señal (< 1s)
   ↓
2. Guarda en Supabase
   ↓
3. Worker procesa screenshot (25s)
   ↓
4. 📱 Envía a Telegram (si telegram_enabled = true)
   ↓
5. Usuario lo recibe en móvil/reloj/tablet
```

**Ventaja:** El mensaje YA incluye el link al screenshot (no hay que esperar).

---

### **Multi-dispositivo Automático:**

Si el usuario tiene Telegram en:
- ✅ iPhone → Recibe notificación
- ✅ Apple Watch → Vibra y muestra mensaje
- ✅ iPad → Aparece notificación
- ✅ PC (Telegram Desktop) → Popup

**Todo automático, sin configuración adicional.** 🎯

---

### **Tutorial para Usuarios:**

Ver sección "Configuración Completa (con Telegram)" arriba para el código del componente con tutorial integrado.

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
- ✅ Notificaciones a Telegram por usuario
- ✅ **Sistema de cuotas configurable desde .env** ⭐ NUEVO
- ✅ **Endpoint `/api/quota` para dashboard** ⭐ NUEVO

### **Próximo:**
- [ ] Soporte para Layout ID de TradingView
- [ ] Pool de browsers keep-alive (API v3)
- [ ] Detección dinámica de carga
- [ ] WebSocket real-time para dashboard
- [ ] Analytics avanzados
- [ ] Notificaciones Discord (opcional)

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

