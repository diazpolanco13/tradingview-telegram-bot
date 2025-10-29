# 🌐 Integración Dashboard Next.js - Manual para IA

> **Guía completa para implementar el dashboard de alertas en la plataforma APIDevs (Next.js)**

**Microservicio API:** https://alerts.apidevs-api.com/  
**Supabase Project:** zzieiqxlxfydvexalbsr  
**Stack:** Next.js 14+ + Supabase + Tailwind CSS

---

## 🎯 Objetivo

Crear un dashboard donde cada cliente de indicadores de APIDevs pueda:
1. **Ver sus alertas** en tiempo real con screenshots automáticos
2. **Configurar** cookies, webhook, chart ID y Telegram
3. **Rastrear resultados** (win/loss) y ver estadísticas
4. **Recibir notificaciones** en Telegram (móvil/reloj/tablet)

---

## 📊 Estructura de Datos (Supabase)

### **Tablas que consumirás:**

#### **1. `trading_signals`** (Alertas del usuario)

```sql
-- Campos principales:
id                    uuid PRIMARY KEY
user_id               uuid → auth.users (FK)
ticker                varchar          # "BINANCE:BTCUSDT"
exchange              varchar          # "BINANCE"
symbol                varchar          # "BTCUSDT"
price                 numeric          # 67890.50
signal_type           varchar          # "Divergencia Alcista 🟢"
direction             varchar          # "LONG" / "SHORT"
chart_id              varchar          # "Q7w5R5x8"
indicator_name        varchar          # "🐸 ADX DEF APIDEVS 👑"

-- Screenshot:
screenshot_url        text             # URL de TradingView o Supabase
screenshot_status     varchar          # pending/processing/completed/failed

-- Tracking manual del usuario:
result                varchar          # pending/win/loss/breakeven/skip
entry_price           numeric
exit_price            numeric
profit_loss           numeric          # Ganancia/pérdida en $
profit_loss_percent   numeric          # Ganancia/pérdida en %
notes                 text

-- Metadata:
raw_message           text             # JSON original del webhook
parsed_data           jsonb            # Datos parseados
timestamp             timestamptz      # Cuándo se disparó
created_at            timestamptz
updated_at            timestamptz

-- RLS: Usuario solo ve SUS señales
-- Policy: WHERE auth.uid() = user_id
```

**Consulta típica:**
```sql
SELECT * FROM trading_signals 
WHERE user_id = auth.uid()
ORDER BY created_at DESC 
LIMIT 50;
```

---

#### **2. `trading_signals_config`** (Configuración del usuario)

```sql
-- Campos principales:
id                      uuid PRIMARY KEY
user_id                 uuid UNIQUE → auth.users (FK)

-- Webhook:
webhook_token           varchar UNIQUE   # Token de 64 chars (auto-generado)
webhook_enabled         boolean          # ON/OFF
webhook_requests_count  integer          # Total de requests recibidos
signals_quota           integer          # Límite mensual (100/500/ilimitado)
signals_used_this_month integer          # Contador mensual

-- TradingView:
default_chart_id        varchar          # "Q7w5R5x8"
tv_sessionid            text             # Cookie encriptada ⚠️
tv_sessionid_sign       text             # Cookie encriptada ⚠️
cookies_valid           boolean          # true si cookies funcionan
cookies_updated_at      timestamptz

-- Telegram (opcional):
telegram_enabled        boolean          # ON/OFF
telegram_bot_token      varchar          # Token de @BotFather
telegram_chat_id        varchar          # Chat ID del usuario

-- Preferencias:
screenshot_resolution   varchar          # 720p/1080p/4k
preferred_timezone      varchar          # "America/New_York"
email_notifications     boolean

created_at              timestamptz
updated_at              timestamptz

-- RLS: Usuario solo ve SU config
-- Policy: WHERE auth.uid() = user_id
```

**Consulta típica:**
```sql
SELECT * FROM trading_signals_config 
WHERE user_id = auth.uid()
LIMIT 1;
```

---

#### **3. `trading_signals_stats`** (Estadísticas pre-calculadas)

```sql
-- Campos:
id                  uuid PRIMARY KEY
user_id             uuid UNIQUE → auth.users (FK)
total_signals       integer
signals_with_result integer
wins                integer
losses              integer
breakevens          integer
win_rate            numeric          # Porcentaje
total_profit_loss   numeric          # P&L total en $
avg_profit_per_win  numeric
avg_loss_per_loss   numeric
profit_factor       numeric
largest_win         numeric
largest_loss        numeric
current_streak      integer
max_win_streak      integer
max_loss_streak     integer
last_calculated_at  timestamptz

-- RLS: Usuario solo ve SUS stats
```

**Consulta típica:**
```sql
SELECT * FROM trading_signals_stats 
WHERE user_id = auth.uid()
LIMIT 1;
```

---

## 🏗️ Estructura del Dashboard

### **Routing en Next.js:**

```
app/
└── dashboard/
    ├── alerts/
    │   └── page.tsx              # TAB 1: Mis Alertas
    │
    └── config/
        └── page.tsx              # TAB 2: Configuración
```

---

## 📡 Consumo de API

### **Microservicio Endpoints:**

**Base URL:** `https://alerts.apidevs-api.com`

Todos requieren **JWT de Supabase** en header:
```typescript
headers: {
  'Authorization': `Bearer ${session?.access_token}`
}
```

### **Endpoints disponibles:**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/signals` | GET | Lista de señales (con filtros) |
| `/api/signals/:id` | GET | Señal específica |
| `/api/signals/:id` | PUT | Actualizar resultado (win/loss) |
| `/api/signals/:id` | DELETE | Eliminar señal |
| `/api/config` | GET | Obtener configuración del usuario |
| `/api/config` | PUT | Actualizar configuración |
| `/api/stats` | GET | Obtener estadísticas |
| **`/api/quota`** | **GET** | **⭐ Obtener cuota del usuario (NUEVO)** |

**Importante:** Alternativamente, puedes consultar **DIRECTAMENTE a Supabase** sin pasar por el microservicio (más rápido).

---

## 🎨 TAB 1: Mis Alertas

### **Componente Principal:**

```typescript
// app/dashboard/alerts/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { AlertCard } from '@/components/trading/AlertCard'
import { AlertFilters } from '@/components/trading/AlertFilters'

export default function AlertsPage() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all/pending/win/loss
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadSignals()
    subscribeToRealtime()
  }, [filter])

  // MÉTODO 1: Consulta DIRECTA a Supabase (recomendado - más rápido)
  async function loadSignals() {
    setLoading(true)
    
    let query = supabase
      .from('trading_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    // Aplicar filtro
    if (filter !== 'all') {
      query = query.eq('result', filter)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error cargando señales:', error)
      return
    }
    
    setSignals(data)
    setLoading(false)
  }

  // Real-time: Escuchar nuevas señales
  function subscribeToRealtime() {
    const channel = supabase
      .channel('signals_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trading_signals'
      }, (payload) => {
        // Nueva señal → Agregar al inicio
        setSignals(prev => [payload.new, ...prev])
        
        // Mostrar notificación del navegador
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚨 Nueva Señal de Trading', {
            body: `${payload.new.ticker} - ${payload.new.signal_type}`,
            icon: '/logo.png'
          })
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trading_signals'
      }, (payload) => {
        // Screenshot completado → Actualizar UI
        setSignals(prev => prev.map(s => 
          s.id === payload.new.id ? payload.new : s
        ))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // MÉTODO 2: Via API del microservicio (alternativo)
  async function loadSignalsViaAPI() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(
      `https://alerts.apidevs-api.com/api/signals?limit=50&result=${filter}`,
      {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      }
    )
    
    const result = await response.json()
    if (result.success) {
      setSignals(result.data)
    }
    setLoading(false)
  }

  // Actualizar resultado de señal
  async function updateSignalResult(signalId: string, result: 'win' | 'loss' | 'breakeven' | 'skip', pnl?: number) {
    // Actualizar en Supabase directamente
    const { error } = await supabase
      .from('trading_signals')
      .update({ 
        result,
        profit_loss: pnl,
        updated_at: new Date().toISOString()
      })
      .eq('id', signalId)
    
    if (!error) {
      loadSignals() // Recargar
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📡 Mis Alertas</h1>
        <div className="text-sm text-gray-500">
          {signals.length} señales
        </div>
      </div>

      {/* Filtros */}
      <AlertFilters 
        activeFilter={filter}
        onFilterChange={setFilter}
        stats={{
          total: signals.length,
          pending: signals.filter(s => s.result === 'pending').length,
          wins: signals.filter(s => s.result === 'win').length,
          losses: signals.filter(s => s.result === 'loss').length
        }}
      />

      {/* Lista de señales */}
      <div className="grid gap-4">
        {signals.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 text-lg mb-2">
              📭 No hay señales aún
            </p>
            <p className="text-sm text-gray-400">
              Configura tu webhook en TradingView para empezar a recibir alertas
            </p>
          </div>
        ) : (
          signals.map(signal => (
            <AlertCard 
              key={signal.id}
              signal={signal}
              onUpdateResult={updateSignalResult}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

---

### **Componente: AlertCard**

```typescript
// components/trading/AlertCard.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Signal {
  id: string
  ticker: string
  price: number
  signal_type: string
  direction: string
  indicator_name: string
  screenshot_url: string
  screenshot_status: string
  result: string
  profit_loss: number
  created_at: string
}

export function AlertCard({ 
  signal, 
  onUpdateResult 
}: { 
  signal: Signal
  onUpdateResult: (id: string, result: string, pnl?: number) => void 
}) {
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [pnl, setPnl] = useState('')

  // Formatear fecha relativa
  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'Hace ' + seconds + ' segundos'
    if (seconds < 3600) return 'Hace ' + Math.floor(seconds / 60) + ' minutos'
    if (seconds < 86400) return 'Hace ' + Math.floor(seconds / 3600) + ' horas'
    return 'Hace ' + Math.floor(seconds / 86400) + ' días'
  }

  // Color según dirección
  const directionColor = signal.direction === 'LONG' 
    ? 'text-green-600 bg-green-100' 
    : 'text-red-600 bg-red-100'

  // Badge de resultado
  const resultBadge = {
    pending: { text: 'Pendiente', color: 'bg-gray-500' },
    win: { text: 'Win ✅', color: 'bg-green-600' },
    loss: { text: 'Loss ❌', color: 'bg-red-600' },
    breakeven: { text: 'Breakeven', color: 'bg-yellow-600' },
    skip: { text: 'Skipped', color: 'bg-gray-400' }
  }[signal.result] || { text: signal.result, color: 'bg-gray-500' }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-6">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {signal.ticker}
            </h3>
            <p className="text-sm text-gray-500">
              {signal.indicator_name || 'Indicador'}
            </p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* Resultado */}
            <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${resultBadge.color}`}>
              {resultBadge.text}
            </span>
            
            {/* Dirección */}
            {signal.direction && (
              <span className={`px-3 py-1 rounded text-sm font-semibold ${directionColor}`}>
                {signal.direction === 'LONG' ? '📈 LONG' : '📉 SHORT'}
              </span>
            )}
          </div>
        </div>

        {/* Datos principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Precio</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ${signal.price.toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-500">Señal</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {signal.signal_type || 'N/A'}
            </p>
          </div>
          
          <div>
            <p className="text-xs text-gray-500">Timestamp</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {timeAgo(signal.created_at)}
            </p>
          </div>
          
          {signal.profit_loss && (
            <div>
              <p className="text-xs text-gray-500">P&L</p>
              <p className={`text-lg font-bold ${signal.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {signal.profit_loss >= 0 ? '+' : ''}{signal.profit_loss.toFixed(2)} $
              </p>
            </div>
          )}
        </div>

        {/* Screenshot */}
        {signal.screenshot_url ? (
          <div className="mb-4">
            <div className="relative cursor-pointer" onClick={() => setShowScreenshot(!showScreenshot)}>
              <img 
                src={signal.screenshot_url}
                alt={`Chart de ${signal.ticker}`}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition"
              />
              <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-white text-xs">
                Click para ampliar
              </div>
            </div>
            
            <a 
              href={signal.screenshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
            >
              🔗 Ver en TradingView (interactivo)
            </a>
          </div>
        ) : (
          <div className="mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
            {signal.screenshot_status === 'processing' ? (
              <div>
                <div className="animate-pulse text-yellow-600 mb-2">⏳</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Capturando screenshot...
                </p>
              </div>
            ) : signal.screenshot_status === 'failed' ? (
              <div>
                <p className="text-sm text-red-600">❌ Screenshot falló</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">📸 Screenshot pendiente...</p>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        {signal.result === 'pending' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm font-medium mb-3">Marcar resultado:</p>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => {
                  const pnlValue = parseFloat(pnl) || 0
                  onUpdateResult(signal.id, 'win', pnlValue)
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
              >
                ✅ Win
              </button>
              
              <button
                onClick={() => {
                  const pnlValue = parseFloat(pnl) || 0
                  onUpdateResult(signal.id, 'loss', pnlValue)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
              >
                ❌ Loss
              </button>
              
              <button
                onClick={() => onUpdateResult(signal.id, 'breakeven')}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-semibold"
              >
                ⏸️ Breakeven
              </button>
              
              <button
                onClick={() => onUpdateResult(signal.id, 'skip')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                ⏭️ Skip
              </button>
            </div>
            
            <input
              type="number"
              placeholder="P&L en $ (opcional)"
              value={pnl}
              onChange={e => setPnl(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
            />
          </div>
        )}

        {/* Notas del usuario */}
        {signal.notes && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              📝 {signal.notes}
            </p>
          </div>
        )}
      </div>

      {/* Modal Screenshot Ampliado */}
      {showScreenshot && signal.screenshot_url && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowScreenshot(false)}
        >
          <div className="max-w-6xl w-full">
            <img 
              src={signal.screenshot_url}
              alt="Screenshot ampliado"
              className="w-full rounded-lg"
            />
            <button className="mt-4 text-white bg-gray-800 px-4 py-2 rounded">
              Cerrar (ESC)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### **Componente: AlertFilters**

```typescript
// components/trading/AlertFilters.tsx
interface AlertFiltersProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  stats: {
    total: number
    pending: number
    wins: number
    losses: number
  }
}

export function AlertFilters({ activeFilter, onFilterChange, stats }: AlertFiltersProps) {
  const filters = [
    { value: 'all', label: 'Todas', count: stats.total, color: 'gray' },
    { value: 'pending', label: 'Pendientes', count: stats.pending, color: 'blue' },
    { value: 'win', label: 'Wins', count: stats.wins, color: 'green' },
    { value: 'loss', label: 'Losses', count: stats.losses, color: 'red' }
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {filters.map(filter => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={`
            px-4 py-2 rounded-lg font-medium whitespace-nowrap transition
            ${activeFilter === filter.value 
              ? `bg-${filter.color}-600 text-white` 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }
          `}
        >
          {filter.label} ({filter.count})
        </button>
      ))}
    </div>
  )
}
```

---

## ⚙️ TAB 2: Configuración

### **Componente Principal:**

```typescript
// app/dashboard/config/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function ConfigPage() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [sessionid, setSessionid] = useState('')
  const [sessionidSign, setSessionidSign] = useState('')
  const [chartId, setChartId] = useState('')
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadConfig()
  }, [])

  // Cargar configuración desde Supabase
  async function loadConfig() {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('trading_signals_config')
      .select('*')
      .single()
    
    if (error) {
      console.error('Error cargando config:', error)
      
      // Si no existe config, crear una
      if (error.code === 'PGRST116') {
        await createInitialConfig()
        return
      }
    }
    
    if (data) {
      setConfig(data)
      setChartId(data.default_chart_id || '')
      setTelegramEnabled(data.telegram_enabled || false)
      setTelegramChatId(data.telegram_chat_id || '')
      // Nota: cookies y token no se devuelven por seguridad
    }
    
    setLoading(false)
  }

  // Crear config inicial para usuario nuevo
  async function createInitialConfig() {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Generar webhook token único
    const webhookToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    const { data, error } = await supabase
      .from('trading_signals_config')
      .insert({
        user_id: user.id,
        webhook_token: webhookToken,
        webhook_enabled: true,
        signals_quota: 1000, // Free tier (1000 señales/mes)
        signals_used_this_month: 0
      })
      .select()
      .single()
    
    if (!error) {
      setConfig(data)
      setLoading(false)
    }
  }

  // Guardar configuración
  async function saveConfig() {
    setSaving(true)
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    // Chart ID
    if (chartId) updateData.default_chart_id = chartId
    
    // Cookies TradingView (enviar al microservicio para encriptar)
    if (sessionid && sessionidSign) {
      const { data: { session } } = await supabase.auth.getSession()
      
      await fetch('https://alerts.apidevs-api.com/api/config', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tv_sessionid_plain: sessionid,
          tv_sessionid_sign_plain: sessionidSign,
          default_chart_id: chartId,
          telegram_enabled: telegramEnabled,
          telegram_bot_token: telegramToken || undefined,
          telegram_chat_id: telegramChatId || undefined
        })
      })
      
      // Limpiar inputs de cookies por seguridad
      setSessionid('')
      setSessionidSign('')
      
    } else {
      // Solo actualizar otros campos directamente en Supabase
      if (telegramEnabled !== config?.telegram_enabled) {
        updateData.telegram_enabled = telegramEnabled
      }
      if (telegramChatId) updateData.telegram_chat_id = telegramChatId
      if (telegramToken) updateData.telegram_bot_token = telegramToken
      
      const { error } = await supabase
        .from('trading_signals_config')
        .update(updateData)
        .eq('user_id', (await supabase.auth.getUser()).data.user.id)
      
      if (error) {
        alert('❌ Error guardando: ' + error.message)
        setSaving(false)
        return
      }
    }
    
    alert('✅ Configuración guardada correctamente')
    await loadConfig()
    setSaving(false)
  }

  if (loading) {
    return <div className="flex justify-center p-12">Cargando...</div>
  }

  const webhookUrl = config 
    ? `https://alerts.apidevs-api.com/webhook/${config.webhook_token}`
    : 'Cargando...'

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">⚙️ Configuración</h1>

      {/* SECCIÓN 1: WEBHOOK URL */}
      <section className="bg-gradient-to-r from-purple-500 to-blue-600 p-6 rounded-lg text-white shadow-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🔗 Tu Webhook Personalizado
        </h2>
        
        <div className="bg-black/30 p-4 rounded-lg font-mono text-sm break-all mb-4">
          {webhookUrl}
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl)
              alert('✅ Webhook copiado!')
            }}
            className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition"
          >
            📋 Copiar Webhook
          </button>
          
          <button 
            onClick={() => window.open('https://www.tradingview.com/chart/', '_blank')}
            className="bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-900 transition"
          >
            🌐 Abrir TradingView
          </button>
        </div>
        
        <p className="text-xs mt-3 text-blue-100">
          Usa esta URL en tus alertas de TradingView para recibir señales automáticamente
        </p>
      </section>

      {/* SECCIÓN 2: COOKIES TRADINGVIEW */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🍪 Cookies de TradingView
        </h2>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ <strong>Importante:</strong> Las cookies permiten capturar screenshots con TUS indicadores privados.
            Sin ellas, solo verás charts básicos.
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              sessionid:
              <span className="text-gray-500 ml-2">(32 caracteres)</span>
            </label>
            <input
              type="password"
              placeholder="••••••••••••••••••••••••••••••••"
              value={sessionid}
              onChange={e => setSessionid(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              sessionid_sign:
              <span className="text-gray-500 ml-2">(~47 caracteres)</span>
            </label>
            <input
              type="password"
              placeholder="••••••••••••••••••••••••••••••••"
              value={sessionidSign}
              onChange={e => setSessionidSign(e.target.value)}
              className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm">Estado actual:</span>
          {config?.cookies_valid ? (
            <span className="text-green-600 font-semibold flex items-center gap-1">
              ✅ Cookies válidas y funcionando
            </span>
          ) : (
            <span className="text-red-600 font-semibold flex items-center gap-1">
              ❌ No configuradas o expiradas
            </span>
          )}
        </div>
        
        {/* Tutorial colapsable */}
        <details className="mt-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
            📖 Tutorial: ¿Cómo obtener las cookies?
          </summary>
          <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex gap-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">1</span>
              <div>
                <p className="font-medium">Abre TradingView y loguéate</p>
                <p className="text-gray-500">https://www.tradingview.com/</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">2</span>
              <div>
                <p className="font-medium">Presiona F12 (DevTools)</p>
                <p className="text-gray-500">Se abre el inspector del navegador</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">3</span>
              <div>
                <p className="font-medium">Ve a Application → Cookies</p>
                <p className="text-gray-500">Expande "https://www.tradingview.com"</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">4</span>
              <div>
                <p className="font-medium">Copia los valores</p>
                <p className="text-gray-500">
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">sessionid</code> (32 caracteres) y 
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded ml-1">sessionid_sign</code> (~47 caracteres)
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">5</span>
              <div>
                <p className="font-medium">Pega aquí arriba y guarda</p>
                <p className="text-gray-500">Las cookies se encriptan automáticamente</p>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* SECCIÓN 3: CHART ID */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">📊 Chart ID</h2>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>Tip:</strong> Este es el ID de tu chart en TradingView donde tienes configurados tus indicadores.
            Los screenshots mostrarán EXACTAMENTE lo que ves en ese chart.
          </p>
        </div>
        
        <input
          type="text"
          placeholder="Q7w5R5x8"
          value={chartId}
          onChange={e => setChartId(e.target.value)}
          className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-lg"
        />
        
        <details className="mt-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
            📖 ¿Cómo obtener mi Chart ID?
          </summary>
          <div className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>1. Abre tu chart en TradingView</p>
            <p>2. Agrega todos tus indicadores favoritos</p>
            <p>3. Click en <strong>"Share"</strong> (compartir)</p>
            <p>4. TradingView te da una URL como:</p>
            <code className="block bg-gray-200 dark:bg-gray-800 p-2 rounded my-2">
              https://www.tradingview.com/chart/<span className="text-blue-600 font-bold">Q7w5R5x8</span>/
            </code>
            <p>5. El ID es la parte resaltada: <code className="bg-yellow-200 dark:bg-yellow-700 px-1 rounded">Q7w5R5x8</code></p>
            <p>6. Cópialo y pégalo arriba</p>
          </div>
        </details>
        
        {config?.default_chart_id && (
          <a 
            href={`https://www.tradingview.com/chart/${config.default_chart_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-700"
          >
            🔗 Ver mi chart en TradingView →
          </a>
        )}
      </section>

      {/* SECCIÓN 4: TELEGRAM (OPCIONAL) */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">📱 Notificaciones a Telegram</h2>
        
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-lg mb-6 text-white">
          <p className="font-semibold mb-2">🎁 Bonus: Recibe alertas en tu móvil</p>
          <p className="text-sm text-blue-100">
            Configura tu bot de Telegram para recibir PUSH notifications instantáneas en tu móvil, 
            reloj inteligente o tablet. Multi-dispositivo automático.
          </p>
        </div>
        
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <p className="font-medium">Habilitar notificaciones Telegram</p>
              <p className="text-sm text-gray-500">
                Recibe alertas donde estés
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={telegramEnabled}
                onChange={e => setTelegramEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {/* Campos de Telegram (solo si está habilitado) */}
          {telegramEnabled && (
            <div className="space-y-4 pl-4 border-l-4 border-blue-600">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Token del Bot:
                </label>
                <input
                  type="password"
                  placeholder="8257215317:AAGvfmsjEx_IP4Oh-lb-ETYfyCs4W8ibmsE"
                  value={telegramToken}
                  onChange={e => setTelegramToken(e.target.value)}
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Obtenlo de @BotFather en Telegram
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Chat ID:
                </label>
                <input
                  type="text"
                  placeholder="123456789 o -1001234567890 (canal)"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tu ID de chat personal o de canal
                </p>
              </div>
              
              {/* Tutorial Telegram */}
              <details className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <summary className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">
                  📖 Tutorial: Crear tu Bot de Telegram (3 minutos)
                </summary>
                
                <div className="mt-4 space-y-4 text-sm">
                  <div>
                    <p className="font-semibold mb-2">Paso 1: Crear Bot</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                      <li>Abre Telegram</li>
                      <li>Busca <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">@BotFather</code></li>
                      <li>Envía: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/newbot</code></li>
                      <li>Nombre: "Mis Alertas de Trading"</li>
                      <li>Username: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">tu_usuario_alertas_bot</code></li>
                      <li>BotFather te dará un <strong>TOKEN</strong> → Guárdalo</li>
                    </ol>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Paso 2: Obtener Chat ID</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400">
                      <li>Busca tu bot en Telegram</li>
                      <li>Envíale: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start</code></li>
                      <li>Abre en navegador: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">https://api.telegram.org/bot{'{TOKEN}'}/getUpdates</code></li>
                      <li>Busca: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">"chat":{'{'}"{id}": 123456789{'}'}</code></li>
                      <li>Ese número es tu <strong>Chat ID</strong></li>
                    </ol>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Paso 3: Guardar</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Pega el Token y Chat ID arriba y haz click en "Guardar Configuración"
                    </p>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>

      {/* SECCIÓN 5: CUOTA DEL USUARIO ⭐ NUEVO */}
      <QuotaWidget />

      {/* SECCIÓN 6: ESTADÍSTICAS */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">📊 Uso del Servicio</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">
              {config?.signals_used_this_month || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Señales este mes</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {config?.signals_quota || 100}
            </p>
            <p className="text-sm text-gray-500 mt-1">Cuota mensual</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-green-600">
              {config?.webhook_requests_count || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total recibidos</p>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">
              {config?.cookies_valid ? '✅' : '❌'}
            </p>
            <p className="text-sm text-gray-500 mt-1">Screenshots</p>
          </div>
        </div>
      </section>

      {/* Botón guardar */}
      <div className="sticky bottom-6">
        <button 
          onClick={saveConfig}
          disabled={saving}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-lg font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? '⏳ Guardando...' : '💾 Guardar Configuración'}
        </button>
      </div>
      
      <p className="text-xs text-center text-gray-500">
        🔒 Las cookies se encriptan con AES-256-GCM antes de guardarse
      </p>
    </div>
  )
}
```

---

## 📊 Componente: QuotaWidget ⭐ NUEVO

**Widget visual para mostrar la cuota del usuario de forma clara y atractiva.**

```typescript
// components/trading/QuotaWidget.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface QuotaData {
  total: number
  used: number
  remaining: number
  total_text: string
  remaining_text: string
  percentage: number
  percentage_text: string
  status: 'OK' | 'ADVERTENCIA' | 'CRÍTICO' | 'EXCEDIDO' | 'ILIMITADO'
  status_color: 'green' | 'yellow' | 'orange' | 'red' | 'blue'
  warning: string | null
  can_receive_signals: boolean
  is_unlimited: boolean
}

export function QuotaWidget() {
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadQuota()
  }, [])

  async function loadQuota() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('https://alerts.apidevs-api.com/api/quota', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      const result = await response.json()
      if (result.success) {
        setQuota(result.quota)
      }
    } catch (error) {
      console.error('Error cargando cuota:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    )
  }

  if (!quota) return null

  // Colores dinámicos según estado
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500'
  }

  const textColorClasses = {
    green: 'text-green-600 dark:text-green-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    blue: 'text-blue-600 dark:text-blue-400'
  }

  const bgColorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  }

  return (
    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          📊 Tu Cuota Mensual
        </h2>
        
        {/* Badge de estado */}
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${bgColorClasses[quota.status_color]} ${textColorClasses[quota.status_color]} border`}>
          {quota.status}
        </span>
      </div>
      
      {/* Números grandes */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Usado</p>
          <p className={`text-3xl font-bold ${textColorClasses[quota.status_color]}`}>
            {quota.used}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Restante</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {quota.remaining_text}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</p>
          <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
            {quota.total_text}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      {!quota.is_unlimited && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">
              Progreso: {quota.percentage_text}
            </span>
            <span className={`font-semibold ${textColorClasses[quota.status_color]}`}>
              {quota.used} / {quota.total}
            </span>
          </div>
          
          {/* Barra */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ${colorClasses[quota.status_color]}`}
              style={{ width: `${Math.min(quota.percentage, 100)}%` }}
            >
              <div className="h-full w-full opacity-50 bg-white animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* Plan ilimitado */}
      {quota.is_unlimited && (
        <div className="mb-4 bg-gradient-to-r from-purple-500 to-blue-600 p-4 rounded-lg text-white text-center">
          <p className="text-2xl font-bold mb-1">∞ Ilimitado</p>
          <p className="text-sm opacity-90">Disfruta de señales sin límites</p>
        </div>
      )}

      {/* Advertencia si existe */}
      {quota.warning && (
        <div className={`p-4 rounded-lg border ${bgColorClasses[quota.status_color]}`}>
          <p className={`text-sm font-medium ${textColorClasses[quota.status_color]} flex items-start gap-2`}>
            <span className="text-lg">⚠️</span>
            <span>{quota.warning}</span>
          </p>
        </div>
      )}

      {/* Indicador de señales */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          ¿Puedo recibir señales?
        </span>
        {quota.can_receive_signals ? (
          <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
            ✅ Sí, todo OK
          </span>
        ) : (
          <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
            ❌ Cuota excedida
          </span>
        )}
      </div>

      {/* Botón de upgrade si está cerca del límite */}
      {!quota.is_unlimited && quota.percentage >= 75 && (
        <button className="mt-4 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-105">
          🚀 Actualizar Plan
        </button>
      )}

      {/* Footer informativo */}
      <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
        La cuota se reinicia automáticamente cada mes
      </p>
    </section>
  )
}
```

### **Cómo usar QuotaWidget:**

```typescript
// En tu página de configuración:
import { QuotaWidget } from '@/components/trading/QuotaWidget'

export default function ConfigPage() {
  return (
    <div className="space-y-6">
      <h1>⚙️ Configuración</h1>
      
      {/* Widget de cuota */}
      <QuotaWidget />
      
      {/* Resto de tu configuración... */}
    </div>
  )
}
```

### **También puedes usarlo en el dashboard principal:**

```typescript
// En dashboard/alerts/page.tsx (sidebar o header)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    {/* Lista de alertas */}
  </div>
  
  <div className="space-y-6">
    <QuotaWidget />
    <StatsOverview />
  </div>
</div>
```

---

## 📊 Componente de Estadísticas

```typescript
// components/trading/StatsOverview.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function StatsOverview() {
  const [stats, setStats] = useState(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    // Consulta directa a Supabase
    const { data } = await supabase
      .from('trading_signals_stats')
      .select('*')
      .single()
    
    if (data) {
      setStats(data)
    }
  }

  if (!stats) return null

  const winRate = stats.win_rate || 0
  const winRateColor = winRate >= 60 ? 'text-green-600' : winRate >= 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p className="text-sm text-gray-500 mb-1">Total Señales</p>
        <p className="text-3xl font-bold">{stats.total_signals}</p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p className="text-sm text-gray-500 mb-1">Win Rate</p>
        <p className={`text-3xl font-bold ${winRateColor}`}>
          {winRate.toFixed(1)}%
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p className="text-sm text-gray-500 mb-1">P&L Total</p>
        <p className={`text-3xl font-bold ${stats.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {stats.total_profit_loss >= 0 ? '+' : ''}
          ${stats.total_profit_loss?.toFixed(2) || '0.00'}
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p className="text-sm text-gray-500 mb-1">Racha Actual</p>
        <p className="text-3xl font-bold">
          {stats.current_streak >= 0 ? '🔥' : '❄️'} {Math.abs(stats.current_streak)}
        </p>
      </div>
    </div>
  )
}
```

---

## 🔄 Real-time Updates

### **Hook para suscribirse a cambios:**

```typescript
// hooks/useRealtimeSignals.ts
import { useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function useRealtimeSignals(onNewSignal: (signal: any) => void) {
  const supabase = createClientComponentClient()

  useEffect(() => {
    const channel = supabase
      .channel('user_signals_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trading_signals'
      }, (payload) => {
        // Nueva señal insertada
        onNewSignal(payload.new)
        
        // Opcional: Sonido de notificación
        const audio = new Audio('/notification.mp3')
        audio.play()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trading_signals'
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

// Uso en componente:
function AlertsPage() {
  const [signals, setSignals] = useState([])

  useRealtimeSignals((newSignal) => {
    setSignals(prev => {
      const exists = prev.find(s => s.id === newSignal.id)
      if (exists) {
        // Actualizar existente
        return prev.map(s => s.id === newSignal.id ? newSignal : s)
      } else {
        // Agregar nueva
        return [newSignal, ...prev]
      }
    })
  })

  return <SignalsList signals={signals} />
}
```

---

## 🎨 Diseño Visual Recomendado

### **Layout de 2 Tabs:**

```
┌────────────────────────────────────────────────────────────┐
│  APIDEVS                                        [Usuario] ▼ │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  [📡 Mis Alertas]  [⚙️ Configuración]                      │
│  ═══════════════                                            │
│                                                             │
│  🎯 Estadísticas Generales                                 │
│  ┌────────────┬────────────┬────────────┬────────────┐    │
│  │ 125        │ 65.2%      │ +$2,450    │ 🔥 3       │    │
│  │ Señales    │ Win Rate   │ P&L Total  │ Racha      │    │
│  └────────────┴────────────┴────────────┴────────────┘    │
│                                                             │
│  📋 Filtros: [Todas (125)] [Pendientes (5)] [Wins (75)]    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🟢 BINANCE:BTCUSDT - Divergencia Alcista             │  │
│  │ 💰 $68,234.50 - LONG - hace 5 minutos                │  │
│  │                                                        │  │
│  │ [IMAGEN DEL CHART CON INDICADORES]                    │  │
│  │                                                        │  │
│  │ [✅ Win] [❌ Loss] [⏸️ Breakeven] [⏭️ Skip]            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔴 BINANCE:ETHUSDT - Divergencia Bajista              │  │
│  │ ... más alertas ...                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 Autenticación

**IMPORTANTE:** El microservicio usa **JWT de Supabase** para autenticar requests.

```typescript
// Obtener JWT del usuario logueado:
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Usar en fetch:
fetch('https://alerts.apidevs-api.com/api/signals', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**Supabase valida automáticamente** que el user_id del token coincida con las señales (RLS).

---

## 📱 Notificaciones del Navegador

```typescript
// Pedir permiso y mostrar notificaciones
async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

// Mostrar notificación cuando llega señal nueva
function showBrowserNotification(signal: Signal) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('🚨 Nueva Señal de Trading', {
      body: `${signal.ticker} - ${signal.signal_type}\nPrecio: $${signal.price}`,
      icon: '/logo.png',
      badge: '/badge.png',
      tag: signal.id,
      requireInteraction: true // No desaparece automáticamente
    })
    
    notification.onclick = () => {
      window.focus()
      // Navegar a la señal
      window.location.href = `/dashboard/alerts#${signal.id}`
    }
  }
}
```

---

## 🎯 Checklist de Implementación

### **Paso 1: Estructura base**
- [ ] Crear `app/dashboard/alerts/page.tsx`
- [ ] Crear `app/dashboard/config/page.tsx`
- [ ] Crear `components/trading/AlertCard.tsx`
- [ ] Crear `components/trading/AlertFilters.tsx`
- [ ] Crear `components/trading/StatsOverview.tsx`
- [ ] **Crear `components/trading/QuotaWidget.tsx`** ⭐ NUEVO

### **Paso 2: Funcionalidades**
- [ ] Consulta a `trading_signals` con filtros
- [ ] Real-time subscription con Supabase
- [ ] Botones Win/Loss funcionales
- [ ] Modal de screenshot ampliado
- [ ] Formulario de configuración completo

### **Paso 3: Configuración**
- [ ] Form de cookies TradingView
- [ ] Display de webhook URL
- [ ] Input de Chart ID
- [ ] Toggle + fields de Telegram
- [ ] Tutorial colapsable integrado

### **Paso 4: Polish**
- [ ] Notificaciones del navegador
- [ ] Animaciones de carga
- [ ] Estados vacíos bonitos
- [ ] Responsive mobile
- [ ] Dark mode completo

---

## 🧪 Testing

### **Verificar que funcione:**

```typescript
// 1. Usuario se loguea
// 2. Navega a /dashboard/alerts
// 3. Debe ver: Lista vacía o señales existentes
// 4. Ir a /dashboard/config
// 5. Debe ver: Webhook URL generado automáticamente
// 6. Configurar cookies
// 7. Enviar señal de prueba con cURL
// 8. Ver que aparece en real-time en /dashboard/alerts
```

---

## 💡 Tips de Implementación

### **1. Usar Supabase DIRECTAMENTE (más rápido):**

```typescript
// ✅ MEJOR: Consulta directa
const { data } = await supabase
  .from('trading_signals')
  .select('*')
  .order('created_at', { ascending: false })

// ⚠️ Alternativa: Via microservicio
const response = await fetch('https://alerts.apidevs-api.com/api/signals')
```

**Razón:** RLS ya protege los datos, no necesitas proxy.

---

### **2. Real-time es CRÍTICO:**

Sin real-time, usuario tiene que refrescar página para ver nuevas señales.
Con real-time, aparecen automáticamente. **Mejor UX.**

---

### **3. Mostrar estado del screenshot:**

```typescript
{signal.screenshot_status === 'processing' && (
  <div className="animate-pulse">
    ⏳ Capturando screenshot... (~20 segundos)
  </div>
)}

{signal.screenshot_status === 'completed' && (
  <img src={signal.screenshot_url} />
)}
```

---

### **4. Validación de cookies:**

```typescript
// Al guardar cookies, hacer test:
const testResponse = await fetch(
  'https://alerts.apidevs-api.com/api/config',
  { method: 'PUT', body: { tv_sessionid_plain: '...' } }
)

if (testResponse.ok) {
  alert('✅ Cookies guardadas y validadas')
} else {
  alert('❌ Cookies inválidas - verifica que sean correctas')
}
```

---

## 🎁 Features Opcionales Bonus

### **1. Exportar a CSV:**

```typescript
function exportToCSV(signals: Signal[]) {
  const csv = [
    ['Fecha', 'Ticker', 'Precio', 'Señal', 'Dirección', 'Resultado', 'P&L'].join(','),
    ...signals.map(s => [
      new Date(s.created_at).toLocaleString(),
      s.ticker,
      s.price,
      s.signal_type,
      s.direction,
      s.result,
      s.profit_loss || 0
    ].join(','))
  ].join('\n')
  
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alertas-${new Date().toISOString()}.csv`
  a.click()
}
```

---

### **2. Compartir señal:**

```typescript
async function shareSignal(signal: Signal) {
  const shareText = `
🚨 Señal de ${signal.ticker}
💰 Precio: $${signal.price}
📊 ${signal.signal_type}
📸 ${signal.screenshot_url}
  `.trim()
  
  if (navigator.share) {
    await navigator.share({
      title: `Señal de ${signal.ticker}`,
      text: shareText,
      url: signal.screenshot_url
    })
  } else {
    navigator.clipboard.writeText(shareText)
    alert('📋 Copiado al portapapeles')
  }
}
```

---

## 🚀 Resumen para la IA

**Para implementar el dashboard, necesitas:**

1. **2 páginas principales:**
   - `app/dashboard/alerts/page.tsx` (lista de alertas)
   - `app/dashboard/config/page.tsx` (configuración)

2. **4 componentes clave:**
   - `AlertCard` (tarjeta de señal individual)
   - `AlertFilters` (filtros de señales)
   - `StatsOverview` (estadísticas generales)
   - **`QuotaWidget` (widget de cuota del usuario)** ⭐ NUEVO

3. **Consultas a Supabase:**
   - Tabla: `trading_signals` (señales)
   - Tabla: `trading_signals_config` (config)
   - Tabla: `trading_signals_stats` (estadísticas)
   - RLS: Automático (usuario solo ve sus datos)

4. **Real-time:**
   - Suscribirse a INSERT en `trading_signals`
   - Suscribirse a UPDATE (para screenshot_status)
   - Actualizar UI automáticamente

5. **Configuración:**
   - Display de webhook URL (de config.webhook_token)
   - Form para cookies TradingView
   - Input para Chart ID
   - Toggle + fields para Telegram (opcional)

6. **API del microservicio:**
   - Base URL: `https://alerts.apidevs-api.com`
   - Autenticación: JWT de Supabase en header
   - Endpoints: `/api/signals`, `/api/config`, `/api/stats`, **`/api/quota`** ⭐
   - **Alternativa:** Consultar Supabase directamente (más rápido)

---

**El código completo está arriba.** Solo necesitas:
1. Copiar componentes
2. Ajustar estilos a tu tema
3. Agregar al routing de Next.js
4. ¡Listo!

---

---

## 📊 NUEVOS ENDPOINTS DE MONITORING (FASE 2)

### **1. `/admin/metrics` - Dashboard Completo del Sistema**

**Propósito:** Obtener métricas completas del microservicio para crear un dashboard de administración.

**Uso:**
```typescript
const response = await fetch('https://alerts.apidevs-api.com/admin/metrics');
const metrics = await response.json();
```

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2025-10-29T16:00:00Z",
  "uptime": "2d 5h 30m",
  "uptimeSeconds": 192600,
  
  "browserPool": {
    "total": 8,
    "available": 5,
    "inUse": 3,
    "status": "healthy",  // healthy | busy | saturated
    "totalCreated": 12,
    "totalClosed": 4,
    "totalCaptures": 1543,
    "activeCaptures": 3
  },
  
  "queue": {
    "waiting": 12,
    "active": 10,
    "completed": 1543,
    "failed": 7,
    "delayed": 0,
    "paused": 0,
    "total": 1572
  },
  
  "performance": {
    "screenshotsCompleted": 1543,
    "screenshotsFailed": 7,
    "successRate": "99.55%",
    "estimatedPerHour": 132,
    "screenshotsToday": 234,
    "avgScreenshotTime": "6.2s"
  },
  
  "capacity": {
    "currentLoad": "37.5%",
    "maxConcurrency": 10,
    "maxBrowsers": 12,
    "estimatedUsers": 120,
    "maxCapacity": 345,
    "utilizationPercent": "34.8"
  },
  
  "database": {
    "totalSignals": 15234,
    "totalUsers": 45,
    "signalsToday": 234
  },
  
  "system": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "memory": {
      "used": "245.67 MB",
      "total": "512.00 MB"
    }
  }
}
```

**Componente React para visualizar:**
```typescript
export function SystemMetrics() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      const res = await fetch('https://alerts.apidevs-api.com/admin/metrics');
      const data = await res.json();
      setMetrics(data);
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Actualizar cada 5s
    
    return () => clearInterval(interval);
  }, []);
  
  if (!metrics) return <div>Cargando métricas...</div>;
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Browser Pool */}
      <Card>
        <h3>Browser Pool</h3>
        <div className="flex items-center gap-2">
          <Progress value={(metrics.browserPool.inUse / metrics.browserPool.total) * 100} />
          <span>{metrics.browserPool.inUse}/{metrics.browserPool.total}</span>
        </div>
        <Badge variant={metrics.browserPool.status === 'healthy' ? 'success' : 'warning'}>
          {metrics.browserPool.status}
        </Badge>
      </Card>
      
      {/* Queue Stats */}
      <Card>
        <h3>Cola de Procesamiento</h3>
        <div className="space-y-2">
          <div>Esperando: {metrics.queue.waiting}</div>
          <div>Activos: {metrics.queue.active}</div>
          <div>Completados: {metrics.queue.completed}</div>
        </div>
      </Card>
      
      {/* Capacity */}
      <Card>
        <h3>Capacidad del Sistema</h3>
        <Progress value={metrics.capacity.utilizationPercent} />
        <div className="text-sm text-muted">
          {metrics.capacity.estimatedUsers} de {metrics.capacity.maxCapacity} usuarios
        </div>
      </Card>
    </div>
  );
}
```

---

### **2. `/admin/pool-status` - Estado del Browser Pool**

**Propósito:** Ver estado detallado de cada navegador en el pool.

**Respuesta:**
```json
{
  "success": true,
  "initialized": true,
  "config": {
    "minBrowsers": 5,
    "maxBrowsers": 12,
    "idleTimeout": "30min",
    "cleanupInterval": "10min",
    "warmup": true
  },
  "stats": {
    "total": 8,
    "available": 5,
    "inUse": 3,
    "totalCreated": 12,
    "totalClosed": 4,
    "totalCaptures": 1543,
    "activeCaptures": 3
  },
  "browsers": [
    {
      "id": "browser-1",
      "status": "in_use",
      "lastUsed": "2s ago",
      "createdAt": "2025-10-29T14:30:00Z",
      "uptime": "90m"
    },
    {
      "id": "browser-2",
      "status": "available",
      "lastUsed": "45s ago",
      "createdAt": "2025-10-29T14:30:00Z",
      "uptime": "90m"
    }
  ]
}
```

---

### **3. `/admin/queue-stats` - Estadísticas de Cola BullMQ**

**Propósito:** Ver jobs recientes y estado de la cola en detalle.

**Respuesta:**
```json
{
  "success": true,
  "counts": {
    "waiting": 12,
    "active": 10,
    "completed": 1543,
    "failed": 7,
    "delayed": 0,
    "paused": 0
  },
  "recentCompleted": [
    {
      "id": "screenshot-job-123",
      "status": "completed",
      "processedOn": "2025-10-29T16:00:00Z",
      "finishedOn": "2025-10-29T16:00:06Z",
      "duration": "6.2s",
      "data": {
        "ticker": "BINANCE:BTCUSDT",
        "userId": "71b7b58f..."
      }
    }
  ],
  "activeJobs": [
    {
      "id": "screenshot-job-456",
      "status": "active",
      "processedOn": "2025-10-29T16:00:10Z",
      "data": {
        "ticker": "OKX:ETHUSDT.P",
        "userId": "a1b2c3d4..."
      }
    }
  ]
}
```

---

## 🎨 Componente de Admin Dashboard Completo

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function AdminDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [poolStatus, setPoolStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, poolRes] = await Promise.all([
          fetch('https://alerts.apidevs-api.com/admin/metrics'),
          fetch('https://alerts.apidevs-api.com/admin/pool-status')
        ]);
        
        const metricsData = await metricsRes.json();
        const poolData = await poolRes.json();
        
        setMetrics(metricsData);
        setPoolStatus(poolData);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh cada 5s
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Cargando métricas del sistema...</div>;
  }

  if (!metrics) {
    return <div className="p-8 text-center text-red-500">Error cargando métricas</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard del Sistema</h1>
        <Badge variant="outline">Uptime: {metrics.uptime}</Badge>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Browser Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.browserPool.inUse}/{metrics.browserPool.total}</div>
            <Progress value={(metrics.browserPool.inUse / metrics.browserPool.total) * 100} className="mt-2" />
            <Badge className="mt-2" variant={
              metrics.browserPool.status === 'healthy' ? 'success' : 
              metrics.browserPool.status === 'busy' ? 'warning' : 'destructive'
            }>
              {metrics.browserPool.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cola de Procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Esperando:</span>
                <span className="font-semibold">{metrics.queue.waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Activos:</span>
                <span className="font-semibold text-blue-600">{metrics.queue.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Completados:</span>
                <span className="font-semibold text-green-600">{metrics.queue.completed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.performance.successRate}</div>
            <p className="text-sm text-muted-foreground">Tasa de éxito</p>
            <div className="mt-2 text-sm">
              <div>Screenshots hoy: {metrics.performance.screenshotsToday}</div>
              <div>Promedio: {metrics.performance.avgScreenshotTime}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Capacidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.capacity.utilizationPercent}%</div>
            <Progress value={parseFloat(metrics.capacity.utilizationPercent)} className="mt-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.capacity.estimatedUsers} de {metrics.capacity.maxCapacity} usuarios
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Navegadores */}
      {poolStatus?.initialized && (
        <Card>
          <CardHeader>
            <CardTitle>Estado de Navegadores en el Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {poolStatus.browsers.map((browser) => (
                <div key={browser.id} className="border rounded-lg p-4">
                  <div className="font-semibold">{browser.id}</div>
                  <Badge variant={browser.status === 'in_use' ? 'default' : 'secondary'}>
                    {browser.status}
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-2">
                    <div>Usado: {browser.lastUsed}</div>
                    <div>Uptime: {browser.uptime}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

**Versión:** 2.0  
**Última actualización:** 29 Octubre 2025  
**FASE 2 - Monitoring completado** ✅

