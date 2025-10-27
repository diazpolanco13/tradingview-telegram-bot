# 🚀 Microservicio de Captura de Señales de TradingView

## ✅ IMPLEMENTACIÓN COMPLETADA

### 📋 Resumen

Hemos transformado tu bot single-user en un **microservicio multi-tenant completo** que:

- ✅ Recibe alertas de TradingView vía webhook único por usuario
- ✅ Almacena señales en Supabase PostgreSQL
- ✅ Procesa screenshots de forma asíncrona con BullMQ
- ✅ Soporta cookies personalizadas por usuario (encriptadas)
- ✅ Expone API REST para que Next.js consuma los datos
- ✅ Implementa RLS (Row Level Security) para aislamiento de datos

---

## 🏗️ Arquitectura Implementada

```
TradingView Alert
       ↓
POST /webhook/:token  (Validar token único del usuario)
       ↓
Supabase PostgreSQL   (Insertar señal + incrementar contador)
       ↓
BullMQ Queue          (Encolar screenshot async)
       ↓
Worker (concurrency: 2)
       ↓
Puppeteer + Cookies Usuario
       ↓
Supabase Storage      (Subir screenshot)
       ↓
Actualizar señal      (screenshot_url + status: completed)
```

---

## 📂 Estructura de Archivos Creados

```
src/
├── config/
│   ├── supabase.js           ✅ Cliente Supabase + funciones CRUD
│   └── redis.js              ✅ Conexión Redis para BullMQ
│
├── utils/
│   └── encryption.js         ✅ Encriptación AES-256-GCM para cookies
│
├── queues/
│   └── screenshotQueue.js    ✅ Cola BullMQ para screenshots
│
├── workers/
│   └── screenshotWorker.js   ✅ Procesador asíncrono de screenshots
│
├── routes/
│   ├── webhook.js          ✅ Webhook multi-tenant /webhook/:token
│   └── dashboard.js          ✅ API REST para Next.js
│
├── services/
│   └── screenshotService.js  ✅ Adaptado con captureWithUserCookies()
│
└── server.js               ✅ Servidor integrado completo
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Creadas:

1. **`trading_signals`** - Señales capturadas
   - Datos del indicador (nombre, ticker, precio, dirección)
   - Screenshot (URL, estado: pending/processing/completed/failed)
   - Tracking manual de resultados (win/loss/breakeven)
   - Campos: `user_id`, `ticker`, `price`, `signal_type`, `direction`, `screenshot_url`, `result`, `profit_loss`, etc.

2. **`trading_signals_config`** - Configuración por usuario
   - **Webhook token único** (auto-generado)
   - **Cookies TradingView encriptadas** (sessionid + sessionid_sign)
   - Cuotas mensuales según plan
   - Preferencias (resolución screenshot, timezone, notificaciones)

3. **`trading_signals_stats`** - Estadísticas pre-calculadas
   - Win rate, profit factor, rachas, P&L total

### Bucket de Storage:

- **`trading-screenshots`** (público, límite 5MB/imagen)
- Organización: `{user_id}/{ticker}_{timestamp}.png`

### Funciones SQL:

- `handle_new_user_trading_config()`: Auto-crea config al registrar usuario
- `increment_webhook_usage()`: Incrementa contador de uso del webhook
- `reset_monthly_signal_quotas()`: Resetea cuotas mensuales (para cron)

---

## 🔐 Seguridad

### Row Level Security (RLS):
- ✅ Usuarios solo ven sus propias señales
- ✅ Service role (microservicio) puede insertar/actualizar
- ✅ Aislamiento completo de datos entre usuarios

### Encriptación de Cookies:
- ✅ AES-256-GCM con salt + IV únicos
- ✅ Cookies TradingView almacenadas encriptadas en Supabase
- ✅ Desencriptación en el worker antes de captura

---

## 🚀 Cómo Ejecutar

### 1. Configurar Variables de Entorno

Crea un archivo `.env` basado en `.env.example.txt`:

```bash
# Generar ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copiar resultado a .env
```

Variables requeridas:
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
REDIS_HOST=localhost
REDIS_PORT=6379
ENCRYPTION_KEY=tu_key_de_64_caracteres_hex
```

### 2. Instalar Redis (si no lo tienes)

**Docker (recomendado):**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Ubuntu:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

### 3. Ejecutar el Microservicio

**Desarrollo:**
```bash
npm run dev
```

**Producción:**
```bash
npm start
```

El servidor se iniciará en `http://localhost:3000`

---

## 📡 Endpoints Disponibles

### Webhook Multi-tenant

**POST** `/webhook/:token`

Recibe alertas de TradingView. Cada usuario tiene su propio token único.

**Ejemplo de configuración en TradingView:**
```
URL: https://tu-dominio.com/webhook/abc123def456...
Method: POST
Body (JSON):
{
  "indicator": "Mi Indicador Pro",
  "ticker": "{{ticker}}",
  "exchange": "{{exchange}}",
  "price": {{close}},
  "signal_type": "BUY_SIGNAL",
  "direction": "LONG",
  "chart_id": "xyz123"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "signal_id": "uuid-de-la-señal",
  "screenshot_queued": true,
  "duration_ms": 150
}
```

### API Dashboard (para Next.js)

Todos los endpoints requieren header de autenticación:
```
Authorization: Bearer {supabase_jwt_token}
```

#### Obtener Señales
**GET** `/api/signals?limit=50&offset=0&result=all`

#### Obtener Señal Específica
**GET** `/api/signals/:id`

#### Actualizar Resultado de Señal
**PUT** `/api/signals/:id`
```json
{
  "result": "win",
  "entry_price": 45000,
  "exit_price": 46000,
  "profit_loss": 1000,
  "profit_loss_percent": 2.22,
  "notes": "Operación exitosa"
}
```

#### Eliminar Señal
**DELETE** `/api/signals/:id`

#### Obtener Configuración
**GET** `/api/config`

#### Actualizar Configuración
**PUT** `/api/config`
```json
{
  "default_chart_id": "xyz123",
  "screenshot_resolution": "1080p",
  "preferred_timezone": "America/New_York",
  "tv_sessionid_plain": "tu_sessionid",
  "tv_sessionid_sign_plain": "tu_sessionid_sign"
}
```

#### Obtener Estadísticas
**GET** `/api/stats`

### Health Check
**GET** `/health`

Verifica estado del microservicio:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "services": {
    "supabase": true,
    "redis": true,
    "puppeteer": true,
    "queue": {
      "waiting": 0,
      "active": 2,
      "completed": 150
    }
  }
}
```

---

## 🔄 Flujo Completo de una Alerta

1. **TradingView envía webhook** → `POST /webhook/{user_token}`
2. **Microservicio valida token** → Consulta `trading_signals_config`
3. **Verifica cuota mensual** → `signals_used_this_month < signals_quota`
4. **Inserta señal en Supabase** → Tabla `trading_signals` (screenshot_status: pending)
5. **Incrementa contador** → `webhook_requests_count++` y `signals_used_this_month++`
6. **Encola screenshot** → BullMQ añade job con cookies del usuario
7. **Worker procesa async** → Desencripta cookies, captura screenshot con Puppeteer
8. **Sube a Storage** → Bucket `trading-screenshots/{user_id}/{ticker}_{timestamp}.png`
9. **Actualiza señal** → `screenshot_url` + `screenshot_status: completed`
10. **Usuario consulta en Next.js** → `GET /api/signals` (ve su señal con screenshot)

---

## 🛠️ Próximos Pasos para Integración con Next.js

### 1. En tu Plataforma Next.js (APIDevs):

```typescript
// lib/trading-signals.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const MICROSERVICE_URL = process.env.NEXT_PUBLIC_MICROSERVICE_URL

export async function getSignals(limit = 50, offset = 0) {
  const supabase = createClientComponentClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(
    `${MICROSERVICE_URL}/api/signals?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    }
  )
  
  return response.json()
}

export async function updateSignal(signalId: string, data: any) {
  const supabase = createClientComponentClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(
    `${MICROSERVICE_URL}/api/signals/${signalId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  )
  
  return response.json()
}
```

### 2. Componente de Dashboard:

```tsx
// app/dashboard/signals/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getSignals } from '@/lib/trading-signals'

export default function SignalsPage() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSignals() {
      const data = await getSignals(50, 0)
      setSignals(data.data)
      setLoading(false)
    }
    loadSignals()
  }, [])

  if (loading) return <div>Cargando señales...</div>

  return (
    <div className="grid gap-4">
      {signals.map((signal) => (
        <div key={signal.id} className="border rounded-lg p-4">
          <h3>{signal.ticker} - {signal.direction}</h3>
          <p>Precio: ${signal.price}</p>
          {signal.screenshot_url && (
            <img src={signal.screenshot_url} alt="Chart" />
          )}
          <span>Estado: {signal.result}</span>
        </div>
      ))}
    </div>
  )
}
```

### 3. Copiar Webhook Token del Usuario:

```tsx
// app/dashboard/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SettingsPage() {
  const [webhookToken, setWebhookToken] = useState('')
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function loadConfig() {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data } = await supabase
        .from('trading_signals_config')
        .select('webhook_token')
        .eq('user_id', user?.id)
        .single()
      
      setWebhookToken(data?.webhook_token || '')
    }
    loadConfig()
  }, [])

  const webhookUrl = `https://tu-microservicio.com/webhook/${webhookToken}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl)
    alert('✅ Webhook URL copiada!')
  }

  return (
    <div className="space-y-4">
      <h2>Tu Webhook Personalizado</h2>
      <div className="bg-gray-100 p-4 rounded">
        <code>{webhookUrl}</code>
      </div>
      <button onClick={copyToClipboard}>
        📋 Copiar URL
      </button>
      
      <div className="mt-6">
        <h3>Cómo configurar en TradingView:</h3>
        <ol className="list-decimal ml-6 space-y-2">
          <li>Copia la URL de arriba</li>
          <li>Ve a tu indicador en TradingView</li>
          <li>Crea una alerta</li>
          <li>En "Notificaciones", selecciona "Webhook URL"</li>
          <li>Pega tu URL personalizada</li>
          <li>Configura el mensaje JSON con tus variables</li>
        </ol>
      </div>
    </div>
  )
}
```

---

## 🎯 Ventajas del Sistema Implementado

### ✅ Escalabilidad
- Cada usuario tiene su propio webhook
- Procesos asíncronos no bloquean
- Worker con concurrency configurable

### ✅ Seguridad
- Tokens únicos por usuario
- RLS en Supabase
- Cookies encriptadas con AES-256-GCM

### ✅ Performance
- Screenshots en background
- Redis para cola rápida
- Storage en Supabase CDN

### ✅ Monitoreable
- Logs estructurados con Pino
- Estado de cola en `/health`
- Reintentos automáticos (3 intentos)

### ✅ Mantenible
- Código modular y limpio
- Separación de responsabilidades
- Backward compatible (webhook V1 legacy)

---

## 📊 Métricas y Monitoreo

El endpoint `/health` te da visibilidad completa:

```json
{
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "supabase": true,
    "redis": true,
    "puppeteer": true,
    "queue": {
      "waiting": 5,      // Jobs en cola
      "active": 2,       // Procesándose ahora
      "completed": 1250, // Total completados
      "failed": 3,       // Fallidos (reintenta 3 veces)
      "total": 1260
    }
  }
}
```

---

## 🐛 Troubleshooting

### Error: "ENCRYPTION_KEY is required"
➡️ Genera una key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
➡️ Agrega al `.env`: `ENCRYPTION_KEY=tu_key_generada`

### Error: "Could not connect to Redis"
➡️ Verifica que Redis esté corriendo: `redis-cli ping` (debe responder PONG)
➡️ Inicia Redis: `docker run -d -p 6379:6379 redis:alpine`

### Error: "Could not connect to Supabase"
➡️ Verifica SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en `.env`
➡️ Confirma que las tablas existen en Supabase Dashboard

### Screenshots no se generan
➡️ Verifica que el usuario haya configurado sus cookies de TradingView
➡️ Consulta `trading_signals_config.cookies_valid` debe ser `true`
➡️ Verifica que `chart_id` esté presente en el mensaje del webhook

---

## 🎉 ¡Listo para Usar!

El microservicio está 100% implementado y listo para integrarse con tu plataforma Next.js. Solo necesitas:

1. ✅ Configurar `.env` con tus credenciales de Supabase
2. ✅ Iniciar Redis
3. ✅ Ejecutar `npm run dev`
4. ✅ Integrar los endpoints en Next.js

**¿Dudas? Revisa los archivos creados o prueba el endpoint /health**

---

**Creado: 27 de Octubre 2025**  
**Versión: 2.0.0**  
**Stack: Node.js + Express + Supabase + BullMQ + Redis + Puppeteer**

