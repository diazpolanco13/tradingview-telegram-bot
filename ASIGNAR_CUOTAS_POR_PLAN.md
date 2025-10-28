# 🎯 Cómo Asignar Cuotas a Usuarios Según su Plan

> **Guía para la IA de Next.js: Cómo actualizar la cuota de un usuario cuando compra o cambia de plan**

---

## 📊 Planes de APIDevs y sus Cuotas

| Plan | Cuota Mensual | Valor en DB |
|------|---------------|-------------|
| **Free** | 1,000 señales/mes (~33/día) | `signals_quota = 1000` |
| **Pro (Mensual)** | 15,000 señales/mes (~500/día) | `signals_quota = 15000` |
| **Pro (Anual)** | 15,000 señales/mes (~500/día) | `signals_quota = 15000` |
| **Lifetime** | ∞ Ilimitado | `signals_quota = -1` |

**Nota:** `-1` = Ilimitado

---

## 🔧 Método 1: Actualizar Directamente en Supabase (Recomendado)

### **Cuándo usar:**
- Cuando un usuario compra un plan
- Cuando un usuario actualiza/degrada su plan
- Cuando caduca una suscripción

### **Código para Next.js:**

```typescript
/**
 * Asignar cuota según el plan del usuario
 * @param userId - UUID del usuario
 * @param plan - 'free' | 'pro' | 'lifetime'
 */
async function assignQuotaByPlan(userId: string, plan: 'free' | 'pro' | 'lifetime') {
  // Mapeo de planes a cuotas
  const quotaMap = {
    free: 1000,      // 1,000 señales/mes
    pro: 15000,      // 15,000 señales/mes
    lifetime: -1     // Ilimitado
  }
  
  const quota = quotaMap[plan] || 1000 // Default: Free

  // Actualizar en Supabase
  const { data, error } = await supabase
    .from('trading_signals_config')
    .update({ 
      signals_quota: quota,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
  
  if (error) {
    console.error('Error asignando cuota:', error)
    return false
  }
  
  console.log(`✅ Cuota asignada: ${plan} → ${quota === -1 ? 'Ilimitado' : quota}`)
  return true
}
```

---

## 📋 Casos de Uso Comunes

### **Caso 1: Usuario se Registra (Free por Defecto)**

```typescript
// Cuando un usuario se registra en tu plataforma
async function onUserSignup(userId: string) {
  // Generar webhook token único
  const webhookToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Crear configuración inicial con plan FREE
  const { data, error } = await supabase
    .from('trading_signals_config')
    .insert({
      user_id: userId,
      webhook_token: webhookToken,
      webhook_enabled: true,
      signals_quota: 1000,              // ← FREE: 1,000/mes
      signals_used_this_month: 0,
      screenshot_resolution: '1080p'
    })
    .select()
  
  return data
}
```

---

### **Caso 2: Usuario Compra Plan Pro (Stripe Webhook)**

```typescript
// Cuando recibes un evento de Stripe: checkout.session.completed
async function onSubscriptionPurchased(stripeEvent: any) {
  const userId = stripeEvent.metadata.user_id
  const planName = stripeEvent.metadata.plan // 'pro' o 'lifetime'
  
  // Actualizar a plan Pro
  await assignQuotaByPlan(userId, planName)
  
  // Opcional: Resetear contador mensual
  await supabase
    .from('trading_signals_config')
    .update({ signals_used_this_month: 0 })
    .eq('user_id', userId)
}
```

---

### **Caso 3: Suscripción Cancelada (Volver a Free)**

```typescript
// Cuando una suscripción se cancela o expira
async function onSubscriptionCanceled(userId: string) {
  // Downgrade a Free
  await assignQuotaByPlan(userId, 'free')
  
  console.log('⚠️ Usuario degradado a plan Free')
}
```

---

### **Caso 4: Upgrade Manual desde Admin Panel**

```typescript
// Endpoint en tu backend de Next.js (solo admin)
async function upgradeUserPlan(userId: string, newPlan: string) {
  // Verificar que quien ejecuta sea admin
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.user_metadata?.role === 'admin'
  
  if (!isAdmin) {
    throw new Error('No autorizado')
  }
  
  // Actualizar cuota
  await assignQuotaByPlan(userId, newPlan)
  
  return { success: true, plan: newPlan }
}
```

---

## 🔄 Método 2: Endpoint del Microservicio (Alternativo)

Si prefieres que el microservicio gestione esto, puedes agregar un endpoint:

```bash
# Endpoint (aún no implementado, se puede agregar)
PUT /admin/users/:userId/quota
Body: { "plan": "pro" }
```

**Ventaja:** Centraliza la lógica en el microservicio
**Desventaja:** Requiere auth adicional para admin

---

## 📊 Verificar Cuota Actual de un Usuario

```typescript
async function getUserQuota(userId: string) {
  const { data, error } = await supabase
    .from('trading_signals_config')
    .select('signals_quota, signals_used_this_month')
    .eq('user_id', userId)
    .single()
  
  if (error) return null
  
  return {
    total: data.signals_quota,
    used: data.signals_used_this_month,
    remaining: data.signals_quota === -1 
      ? -1 
      : Math.max(0, data.signals_quota - data.signals_used_this_month),
    is_unlimited: data.signals_quota === -1
  }
}
```

---

## 🎯 Integración con Stripe (Recomendado)

### **En tu webhook de Stripe:**

```typescript
// pages/api/webhooks/stripe.ts
import { buffer } from 'micro'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role para bypass RLS
)

export const config = {
  api: { bodyParser: false }
}

export default async function handler(req, res) {
  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
  
  // Manejar eventos
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan // 'pro' o 'lifetime'
      
      if (userId && plan) {
        // Asignar cuota según plan
        const quotaMap = {
          free: 1000,
          pro: 15000,
          lifetime: -1
        }
        
        await supabase
          .from('trading_signals_config')
          .update({ 
            signals_quota: quotaMap[plan],
            signals_used_this_month: 0 // Resetear al comprar
          })
          .eq('user_id', userId)
        
        console.log(`✅ Cuota asignada a ${userId}: ${plan} → ${quotaMap[plan]}`)
      }
      break
    }
    
    case 'customer.subscription.deleted': {
      // Suscripción cancelada → Downgrade a Free
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id
      
      if (userId) {
        await supabase
          .from('trading_signals_config')
          .update({ signals_quota: 1000 }) // Free
          .eq('user_id', userId)
        
        console.log(`⚠️ Usuario ${userId} degradado a Free`)
      }
      break
    }
  }
  
  res.json({ received: true })
}
```

---

## 🧪 Testing Manual (Desde Supabase)

```sql
-- Asignar Plan Pro a un usuario
UPDATE trading_signals_config
SET 
  signals_quota = 15000,
  updated_at = NOW()
WHERE user_id = 'uuid-del-usuario';

-- Asignar Plan Lifetime (ilimitado)
UPDATE trading_signals_config
SET 
  signals_quota = -1,
  updated_at = NOW()
WHERE user_id = 'uuid-del-usuario';

-- Verificar
SELECT 
  user_id, 
  signals_quota, 
  signals_used_this_month 
FROM trading_signals_config
WHERE user_id = 'uuid-del-usuario';
```

---

## 📝 Resumen para la IA de Next.js

**Para asignar cuotas a usuarios:**

1. **Cuando se registra:** `signals_quota = 1000` (Free)
2. **Cuando compra Pro:** `signals_quota = 15000`
3. **Cuando compra Lifetime:** `signals_quota = -1` (ilimitado)
4. **Cuando cancela:** `signals_quota = 1000` (volver a Free)

**Tabla:** `trading_signals_config`
**Campo:** `signals_quota`
**Valores:** `1000` | `15000` | `-1`

---

## ⚠️ Importante

- **NUNCA modifiques `signals_used_this_month` manualmente** (se incrementa automáticamente)
- **SÍ puedes resetearlo a 0** cuando un usuario compra un plan nuevo
- **El microservicio valida automáticamente** la cuota en cada webhook
- **El endpoint `/api/quota`** muestra la cuota actual al usuario

---

## 🎁 Bonus: Reset Automático Mensual

Para resetear el contador cada mes, crea una función en Supabase:

```sql
-- Función para resetear contadores (ejecutar cada mes)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE trading_signals_config
  SET signals_used_this_month = 0;
  
  RAISE NOTICE 'Cuotas mensuales reseteadas';
END;
$$;

-- Ejecutar automáticamente cada mes (requiere pg_cron)
SELECT cron.schedule(
  'reset-quotas-monthly',
  '0 0 1 * *', -- Día 1 de cada mes a medianoche
  'SELECT reset_monthly_quotas()'
);
```

---

**¡Con esto la IA de Next.js tiene TODO lo necesario para gestionar cuotas!** 🚀

