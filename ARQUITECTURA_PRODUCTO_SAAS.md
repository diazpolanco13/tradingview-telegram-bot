# 🚀 Arquitectura: SignalHub - Producto SaaS Independiente

> **Documento de Arquitectura** - Plataforma SaaS para Captura y Análisis de Señales de Trading

---

## 🎯 **Visión del Producto**

**SignalHub** es una plataforma SaaS que permite a traders:
- Capturar automáticamente señales de sus indicadores de TradingView
- Visualizar screenshots personalizados en un dashboard moderno
- Analizar performance con métricas avanzadas (win rate, P&L)
- Gestionar múltiples indicadores y estrategias
- Compartir señales con comunidades o alumnos

---

## 💰 **Modelo de Negocio**

### **Planes de Suscripción:**

```
FREE TIER - "Trader Starter"
├── 50 señales/mes
├── 1 indicador
├── Historial 30 días
├── Screenshots 720p
├── Dashboard básico
└── $0/mes
→ Target: Traders principiantes, testing del producto

PRO - "Trader Active"
├── 500 señales/mes
├── 5 indicadores
├── Historial ilimitado
├── Screenshots 1080p
├── Notificaciones Telegram
├── Analytics básicos
├── Exportar CSV
└── $19/mes ($190/año -17%)
→ Target: Traders activos, day traders

PREMIUM - "Trader Professional"
├── Señales ilimitadas
├── Indicadores ilimitados
├── Screenshots 4K
├── Notificaciones multi-canal (Telegram + Email + Discord)
├── Analytics avanzados
├── API access
├── Webhooks personalizados
├── Sin branding SignalHub
└── $59/mes ($590/año -17%)
→ Target: Traders profesionales, gestores de fondos

TEAM - "Trading Academy"
├── Todo lo de Premium
├── 5-20 cuentas de usuario
├── Panel de administración
├── White-label completo
├── Branded reports
├── Soporte prioritario
├── Custom development
└── $199/mes (hasta 10 usuarios) + $15/usuario adicional
→ Target: Educadores, academias de trading, grupos premium
```

### **Ingresos Adicionales:**

```
WHITE-LABEL B2B
├── Setup fee: $1,500-5,000
├── Mensualidad: $300-1,000
└── Target: Creadores de indicadores grandes

AFILIADOS
├── 30% comisión recurrente
├── Cookie: 90 días
└── Target: Influencers de trading, YouTubers

ADD-ONS
├── Señales adicionales: $5 por cada 100
├── Storage extra: $5 por cada 10GB
├── Usuarios extra (Team): $15/usuario/mes
└── Integraciones custom: desde $500
```

### **Proyección de Ingresos (24 meses):**

**Escenario Conservador:**
```
1,000 usuarios free (0% conversión contabilizada)
100 usuarios PRO × $19 = $1,900/mes
20 usuarios PREMIUM × $59 = $1,180/mes
3 usuarios TEAM × $199 = $597/mes
1 white-label × $500 = $500/mes

Total MRR: $4,177/mes
ARR: $50,124/año
```

**Escenario Optimista:**
```
10,000 usuarios free
800 usuarios PRO × $19 = $15,200/mes
150 usuarios PREMIUM × $59 = $8,850/mes
20 usuarios TEAM × $250 (promedio) = $5,000/mes
10 white-label × $600 (promedio) = $6,000/mes
Afiliados: $2,000/mes

Total MRR: $37,050/mes
ARR: $444,600/año
```

---

## 🏛️ **Arquitectura del Sistema**

### **Stack Tecnológico:**

```
FRONTEND
├── Framework: Next.js 14 (App Router)
├── UI: shadcn/ui + Tailwind CSS
├── State: Zustand + React Query
├── Charts: Recharts / Chart.js
├── Forms: React Hook Form + Zod
└── Deploy: Vercel

BACKEND (Supabase como BaaS)
├── Database: PostgreSQL (Supabase)
├── Auth: Supabase Auth (email, Google, GitHub)
├── Storage: Supabase Storage (screenshots)
├── Realtime: Supabase Realtime
├── Functions: Supabase Edge Functions (webhooks internos)
└── Row Level Security (RLS)

MICROSERVICIO DE CAPTURA (Node.js)
├── Framework: Express.js
├── Screenshot: Puppeteer
├── Queues: BullMQ + Redis
├── Workers: PM2 Cluster Mode
└── Deploy: Docker en VPS (Hetzner/DigitalOcean)

PAGOS Y SUSCRIPCIONES
├── Stripe Checkout
├── Stripe Customer Portal
├── Webhooks de Stripe → Supabase
└── Manejo de planes y límites

MONITOREO Y ANALYTICS
├── Logs: Sentry (errores)
├── Analytics: PostHog (producto)
├── Uptime: UptimeRobot / Better Stack
├── Performance: Vercel Analytics
└── Business metrics: Stripe Dashboard + Supabase queries
```

### **Diagrama de Arquitectura:**

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js en Vercel)                               │
│  https://signalhub.app                                      │
│                                                              │
│  Páginas Públicas:                                          │
│  - Landing (/)                                              │
│  - Pricing (/pricing)                                       │
│  - Features (/features)                                     │
│  - Docs (/docs)                                             │
│  - Blog (/blog)                                             │
│                                                              │
│  App Autenticada:                                           │
│  - Dashboard (/dashboard)                                   │
│  - Signals (/dashboard/signals)                             │
│  - Analytics (/dashboard/analytics)                         │
│  - Settings (/dashboard/settings)                           │
│  - Webhooks (/dashboard/webhooks)                           │
│  - Billing (/dashboard/billing)                             │
└─────────────────────────────────────────────────────────────┘
       ↓ Supabase Client (directo)       ↓ Stripe Checkout
       │                                  │
┌──────┴──────────────────────────────────┴────────────────────┐
│  SUPABASE (Backend as a Service)                             │
│                                                               │
│  PostgreSQL Database:                                         │
│  ├── auth.users (Supabase Auth)                              │
│  ├── public.profiles (perfiles extendidos)                   │
│  ├── public.signals (señales capturadas)                     │
│  ├── public.user_config (webhooks, cookies)                  │
│  ├── public.subscriptions (Stripe sync)                      │
│  ├── public.notifications (historial)                        │
│  └── public.analytics_cache (métricas pre-calculadas)        │
│                                                               │
│  Storage Buckets:                                             │
│  ├── screenshots (imágenes PNG públicas)                     │
│  └── exports (CSV/PDF privados)                              │
│                                                               │
│  Edge Functions:                                              │
│  ├── stripe-webhook (procesar eventos)                       │
│  ├── check-quotas (validar límites)                          │
│  └── cleanup-old-signals (cron diario)                       │
│                                                               │
│  Realtime Channels:                                           │
│  └── user_signals (notificar nuevas señales)                 │
└───────────────────────────────────────────────────────────────┘
       ↑ INSERT/UPDATE signals   ↑ Validación de tokens
       │                          │
┌──────┴──────────────────────────┴────────────────────────────┐
│  MICROSERVICIO DE CAPTURA (Docker en VPS)                    │
│  https://capture.signalhub.app                               │
│                                                               │
│  API Gateway (Express):                                       │
│  ├── POST /webhook/u/:token (principal)                      │
│  ├── GET /health (health check)                              │
│  ├── GET /metrics (Prometheus)                               │
│  └── GET /admin/queue-stats (admin)                          │
│                                                               │
│  Processing Pipeline:                                         │
│  ├── 1. Validar token en Supabase                            │
│  ├── 2. Validar cuota del usuario                            │
│  ├── 3. Parsear mensaje TradingView                          │
│  ├── 4. INSERT en Supabase.signals                           │
│  ├── 5. Encolar screenshot (BullMQ)                          │
│  └── 6. Response 200 OK (< 100ms)                            │
│                                                               │
│  Screenshot Workers (Pool):                                   │
│  ├── 5-20 workers (auto-scale)                               │
│  ├── Puppeteer + cookies del usuario                         │
│  ├── Upload a Supabase Storage                               │
│  └── UPDATE signals con URL                                  │
│                                                               │
│  Queue Management (BullMQ + Redis):                           │
│  ├── Cola: screenshot-processing                             │
│  ├── Prioridad por plan (Premium > Pro > Free)               │
│  ├── Retry: 3 intentos con backoff                           │
│  └── Dead Letter Queue para fallos                           │
└───────────────────────────────────────────────────────────────┘
                    ↑ Webhooks de alertas
┌───────────────────────────────────────────────────────────────┐
│  TRADINGVIEW                                                  │
│  Usuarios configuran alertas con sus webhooks personalizados │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  STRIPE (Pagos y Suscripciones)                               │
│  ├── Customer Portal                                          │
│  ├── Checkout Sessions                                        │
│  ├── Subscription Management                                  │
│  └── Webhooks → Supabase Edge Function                        │
└───────────────────────────────────────────────────────────────┘
```

---

## 🗄️ **Modelo de Datos en Supabase**

### **Tabla: `profiles`** (Perfiles de usuario)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Plan y límites
  subscription_tier TEXT DEFAULT 'free', -- free/pro/premium/team
  subscription_status TEXT DEFAULT 'active', -- active/cancelled/past_due
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  
  -- Cuotas mensuales
  signals_quota INTEGER DEFAULT 50,
  signals_used_this_month INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  
  -- Metadata
  onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### **Tabla: `signals`** (Señales capturadas)
```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Datos del indicador
  indicator_name VARCHAR(100),
  ticker VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  symbol VARCHAR(20),
  
  -- Precio y tipo de señal
  price DECIMAL(18, 8),
  signal_type VARCHAR(50), -- Buy, Sell, Alert, etc
  
  -- Screenshot
  chart_id VARCHAR(20),
  screenshot_url TEXT,
  screenshot_status VARCHAR(20) DEFAULT 'pending',
  
  -- Mensaje original
  raw_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Tracking de resultado (usuario edita manualmente)
  result VARCHAR(20) DEFAULT 'pending', -- pending/win/loss/skip
  entry_price DECIMAL(18, 8),
  exit_price DECIMAL(18, 8),
  profit_loss DECIMAL(10, 2),
  profit_loss_percent DECIMAL(6, 2),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_signals_user_timestamp ON signals(user_id, timestamp DESC);
CREATE INDEX idx_signals_user_result ON signals(user_id, result);
CREATE INDEX idx_signals_ticker ON signals(ticker);
CREATE INDEX idx_signals_status ON signals(screenshot_status);

-- RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own signals"
  ON signals FOR ALL
  USING (auth.uid() = user_id);

-- Microservicio puede insertar (service_role)
CREATE POLICY "Service can insert signals"
  ON signals FOR INSERT
  WITH CHECK (true);
```

### **Tabla: `user_config`** (Configuración de webhooks)
```sql
CREATE TABLE user_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Webhook
  webhook_token VARCHAR(100) UNIQUE NOT NULL,
  webhook_enabled BOOLEAN DEFAULT true,
  webhook_last_used TIMESTAMPTZ,
  webhook_requests_count INTEGER DEFAULT 0,
  
  -- TradingView
  default_chart_id VARCHAR(20),
  tv_sessionid TEXT, -- Encriptado
  tv_sessionid_sign TEXT, -- Encriptado
  cookies_valid BOOLEAN DEFAULT false,
  cookies_updated_at TIMESTAMPTZ,
  
  -- Notificaciones
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_chat_id VARCHAR(50),
  discord_webhook_url TEXT,
  email_enabled BOOLEAN DEFAULT true,
  
  -- Preferencias
  screenshot_resolution VARCHAR(20) DEFAULT '1080p', -- 720p/1080p/4k
  auto_classify_signals BOOLEAN DEFAULT false,
  preferred_timezone VARCHAR(50) DEFAULT 'UTC',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_user_config_webhook_token ON user_config(webhook_token);

-- RLS
ALTER TABLE user_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config"
  ON user_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
  ON user_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Microservicio lee para validar
CREATE POLICY "Service can read all configs"
  ON user_config FOR SELECT
  USING (true);
```

### **Tabla: `subscriptions`** (Sync con Stripe)
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe data
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  
  -- Plan details
  plan_name TEXT NOT NULL, -- free/pro/premium/team
  status TEXT NOT NULL, -- active/cancelled/past_due/trialing
  
  -- Billing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

### **Tabla: `analytics_cache`** (Pre-cálculo de métricas)
```sql
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Período
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type VARCHAR(20) NOT NULL, -- daily/weekly/monthly/all_time
  
  -- Métricas
  total_signals INTEGER DEFAULT 0,
  signals_with_result INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5, 2),
  total_profit_loss DECIMAL(12, 2),
  avg_profit_per_win DECIMAL(10, 2),
  avg_loss_per_loss DECIMAL(10, 2),
  profit_factor DECIMAL(8, 2),
  max_consecutive_wins INTEGER DEFAULT 0,
  max_consecutive_losses INTEGER DEFAULT 0,
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period_type, period_start)
);

-- Índice
CREATE INDEX idx_analytics_user_period ON analytics_cache(user_id, period_type);

-- RLS
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics"
  ON analytics_cache FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 🔐 **Autenticación y Seguridad**

### **Supabase Auth Flow:**

```javascript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
  options: {
    data: {
      full_name: 'John Trader'
    }
  }
});

// Trigger: Crear profile y user_config automáticamente
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_config (user_id, webhook_token)
  VALUES (new.id, encode(gen_random_bytes(32), 'hex'));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### **Row Level Security (RLS):**

Todas las tablas tienen RLS habilitado para garantizar que:
- ✅ Usuario solo ve SUS datos
- ✅ No puede modificar datos de otros
- ✅ Microservicio usa `service_role` key (bypass RLS)
- ✅ Frontend usa `anon` key (RLS activo)

### **Encriptación de Cookies:**

```javascript
// En el microservicio
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

## 💳 **Integración con Stripe**

### **Setup de Productos:**

```javascript
// Crear productos en Stripe
const products = [
  {
    name: 'Pro Plan',
    price_monthly: 1900, // $19.00
    price_yearly: 19000, // $190.00 (-17%)
    features: {
      signals_quota: 500,
      indicators: 5,
      screenshot_resolution: '1080p'
    }
  },
  {
    name: 'Premium Plan',
    price_monthly: 5900,
    price_yearly: 59000,
    features: {
      signals_quota: -1, // unlimited
      indicators: -1,
      screenshot_resolution: '4k'
    }
  }
];
```

### **Webhook de Stripe → Supabase:**

```javascript
// Supabase Edge Function: stripe-webhook
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0';

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  const signature = req.headers.get('stripe-signature')!;
  
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    signature,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  );
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Actualizar subscription en Supabase
      await updateSubscription(event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      // Downgrade a free tier
      await cancelSubscription(event.data.object);
      break;
  }
  
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 📊 **Features del Dashboard**

### **1. Dashboard Principal**
```
┌─────────────────────────────────────────────────┐
│ Resumen de Hoy                                  │
├─────────────────────────────────────────────────┤
│ 📊 12 Señales │ ✅ 7 Wins │ ❌ 3 Losses │ 📈 +$450 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Gráfico: Performance Últimos 30 Días           │
│ [Gráfico de línea: Profit/Loss acumulado]      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Últimas Señales                                 │
│ ┌────────────────────────────────────────────┐ │
│ │ BTCUSDT │ Buy │ $67,890 │ ⏱️ 2h ago │ 📸 │ │
│ │ ETHUSDT │ Sell │ $3,245 │ ⏱️ 5h ago │ 📸 │ │
│ └────────────────────────────────────────────┘ │
│ Ver todas →                                     │
└─────────────────────────────────────────────────┘
```

### **2. Página de Señales**
```
Filtros:
[Fecha: Últimos 7 días ▼] [Ticker: Todos ▼] [Resultado: Todos ▼]

Tabla:
┌──────────┬──────┬────────┬─────────┬────────┬───────┬──────────┐
│ Fecha    │ Tick │ Tipo   │ Precio  │ Result │ P/L   │ Actions  │
├──────────┼──────┼────────┼─────────┼────────┼───────┼──────────┤
│ 10/27 2pm│ BTC  │ Buy    │ $67,890 │ Win    │ +$150 │ 👁️ ✏️ 🗑️ │
│ 10/27 1pm│ ETH  │ Sell   │ $3,245  │ Loss   │ -$50  │ 👁️ ✏️ 🗑️ │
└──────────┴──────┴────────┴─────────┴────────┴───────┴──────────┘

Exportar: [CSV] [PDF]
```

### **3. Analytics Avanzados**
```
┌──────────────────────────────────────────┐
│ Métricas Clave (Últimos 30 días)        │
├──────────────────────────────────────────┤
│ Win Rate: 68.5% ████████░░ (45W / 21L)  │
│ Profit Factor: 2.3x                      │
│ Total P/L: +$2,450.00                    │
│ Avg Win: +$75.50                         │
│ Avg Loss: -$45.25                        │
│ Max Consecutive Wins: 7                  │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Performance por Ticker                   │
│ [Gráfico de barras]                      │
│ BTCUSDT: +$850 (12 trades)              │
│ ETHUSDT: +$620 (8 trades)               │
│ SOLUSDT: -$120 (5 trades)               │
└──────────────────────────────────────────┘
```

### **4. Configuración de Webhooks**
```
┌──────────────────────────────────────────────┐
│ Tu Webhook URL:                              │
│ ┌──────────────────────────────────────────┐ │
│ │ https://capture.signalhub.app/           │ │
│ │ webhook/u/abc123def456...                │ │
│ │                                   [Copy] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Chart ID por defecto:                        │
│ [Q7w5R5x8]                                   │
│                                              │
│ ✅ Webhook activo                            │
│ Última señal recibida: Hace 2 horas         │
│ Total señales: 127                           │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Cookies de TradingView                       │
│ Estado: ⚠️ Expiran en 15 días                │
│                                              │
│ [Actualizar Cookies]                         │
│                                              │
│ ℹ️ Necesario para capturar screenshots      │
└──────────────────────────────────────────────┘
```

---

## 🚀 **Go-to-Market Strategy**

### **Fase 1: Pre-Launch (Mes 1-2)**

**Objetivos:**
- Landing page profesional
- Lista de espera: 500+ emails
- Contenido educativo (blog, videos)
- Beta testers: 50 usuarios

**Acciones:**
1. **Landing Page:**
   - Hero: "Track Your Trading Signals Automatically"
   - Demo video (2 min)
   - Features comparison
   - Pricing claro
   - Early bird: 50% off lifetime

2. **Content Marketing:**
   - Blog: "5 Ways to Track Your TradingView Alerts"
   - YouTube tutorial: "Setup TradingView Alerts with SignalHub"
   - SEO: "TradingView alert tracker", "trading journal app"

3. **Beta Program:**
   - 50 usuarios gratis de por vida
   - Feedback intensivo
   - Testimonios y casos de estudio

### **Fase 2: Launch (Mes 3)**

**Objetivos:**
- 1,000 registros
- 50 paying customers
- Product Hunt #1

**Acciones:**
1. **Product Hunt Launch:**
   - Video demo profesional
   - Comentar activamente
   - Ofrecer lifetime deal

2. **Comunidades:**
   - Reddit: r/Daytrading, r/TradingView (150K+ members)
   - Discord servers de trading
   - TradingView Ideas/Chat

3. **Influencer Outreach:**
   - YouTubers de trading (50K-500K subs)
   - Ofrecer plan Premium gratis
   - 30% comisión de afiliado

### **Fase 3: Growth (Mes 4-12)**

**Objetivos:**
- 10,000 usuarios
- 500 paying customers ($10K MRR)
- 10 white-label clientes

**Acciones:**
1. **Paid Ads:**
   - Google Ads: $1,000/mes
   - YouTube Ads: $500/mes
   - Twitter Ads: $500/mes

2. **Partnerships:**
   - Creadores de indicadores
   - Academias de trading
   - Brokers (integración MT4/MT5)

3. **Features Premium:**
   - Auto-classification con AI
   - Backtesting avanzado
   - Integración con brokers
   - Mobile app (PWA primero)

---

## 💰 **Costos Operacionales**

### **Infraestructura (Mes 1-6):**
```
Supabase Pro: $25/mes
VPS (4GB RAM, 2 vCPU): $20/mes
Redis Cloud: $0/mes (free tier)
Vercel Pro: $20/mes
Domain + SSL: $15/año ($1.25/mes)

Total: ~$66/mes
```

### **Software y Servicios:**
```
Stripe: 2.9% + $0.30 por transacción
Sentry (errores): $26/mes
PostHog (analytics): $0 (free tier)
SendGrid (emails): $15/mes
GitHub: $0 (open source)

Total variable: ~3% de ingresos + $41/mes fijo
```

### **Marketing:**
```
Mes 1-3 (pre-launch): $500/mes
Mes 4-12 (growth): $2,000/mes
```

### **Total Año 1:**
```
Infraestructura: $66 × 12 = $792
Software: $41 × 12 = $492
Marketing: ($500 × 3) + ($2,000 × 9) = $19,500
Stripe fees: ~3% de ingresos
Misc (imprevistos): $1,000

Total: ~$22,000 + 3% de ingresos
```

**Break-even:** ~$1,850/MRR (100 usuarios PRO)

---

## 📈 **Métricas Clave (KPIs)**

### **Growth Metrics:**
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- LTV:CAC ratio (target: >3)
- Churn rate (target: <5%)
- Net Revenue Retention (NRR)

### **Product Metrics:**
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Signals processed/day
- Screenshot success rate (target: >95%)
- API response time (target: <100ms)
- Uptime (target: 99.9%)

### **Conversion Funnel:**
```
Landing page visit: 10,000/mes
→ Sign up: 500 (5% conversion)
→ Activate (first signal): 350 (70% activation)
→ Paid conversion: 35 (10% conversion)
→ Retained 3 months: 30 (86% retention)
```

---

## 🛠️ **Roadmap de Producto**

### **Q1 2026: MVP Launch**
- [x] Captura de señales básica
- [x] Dashboard de señales
- [x] Screenshots automáticos
- [x] Stripe integration
- [x] Landing page
- [ ] Product Hunt launch
- [ ] 100 usuarios beta

### **Q2 2026: Growth**
- [ ] Analytics avanzados
- [ ] Notificaciones multi-canal
- [ ] Exportar CSV/PDF
- [ ] API pública
- [ ] Mobile app (PWA)
- [ ] 1,000 usuarios totales
- [ ] $10K MRR

### **Q3 2026: Premium Features**
- [ ] Auto-classification con AI
- [ ] Backtesting engine
- [ ] Integración MT4/MT5
- [ ] White-label platform
- [ ] Team management
- [ ] 5,000 usuarios totales
- [ ] $25K MRR

### **Q4 2026: Scale**
- [ ] Mobile apps nativas (iOS/Android)
- [ ] Integraciones con brokers
- [ ] Social features (copy trading)
- [ ] Advanced analytics (ML-powered)
- [ ] Enterprise plan
- [ ] 10,000 usuarios totales
- [ ] $50K MRR

---

## ✅ **Ventajas Competitivas**

### **vs TradingView Alerts:**
- ✅ Screenshots automáticos con tus indicadores
- ✅ Historial permanente
- ✅ Analytics de performance
- ✅ Tracking de P/L

### **vs AlertaTron:**
- ✅ UX moderna
- ✅ Screenshots en HD/4K
- ✅ Real-time updates
- ✅ Analytics avanzados
- ✅ Mejor pricing

### **vs Trading Journals (Edgewonk, TraderSync):**
- ✅ 100% automático (no manual entry)
- ✅ Screenshots incluidos
- ✅ Más barato ($19 vs $50+)
- ✅ Específico para TradingView

---

## 🎯 **Conclusión**

**SignalHub es un producto SaaS viable con:**
- ✅ Problema real y validado
- ✅ Solución técnica probada
- ✅ Mercado gigante (50M+ usuarios TradingView)
- ✅ Modelo de negocio claro (SaaS + White-label)
- ✅ Costos operacionales bajos
- ✅ Margen alto (80%+)
- ✅ Escalable y sticky
- ✅ Competencia débil
- ✅ Múltiples canales de monetización

**Tiempo estimado de desarrollo:**
- MVP: 2-3 meses (1 dev full-time)
- Launch: Mes 3-4
- Break-even: Mes 6-9 ($1,850 MRR)
- Rentabilidad: Mes 9-12 ($5K+ MRR)

**Inversión inicial requerida:**
- Bootstrap: $25K (6 meses runway)
- Seed round: $100-500K (contratar equipo, marketing agresivo)

---

**Versión:** 1.0 - Producto SaaS  
**Última actualización:** Octubre 2025  
**Estado:** Listo para pitch/development  
**Nombre temporal:** SignalHub (TBD)

