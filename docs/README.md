# 📚 TradingView Telegram Bot - Documentación

## 📖 Documentos Principales

### **Bot Actual:**
- **[README Principal](../README.md)** - Guía completa de instalación y uso del bot actual
- **[Admin Guide](ADMIN_GUIDE.md)** - Panel de administración y gestión de cookies

### **Arquitecturas de Evolución:**
- **[Arquitectura Microservicio APIDevs](../ARQUITECTURA_MICROSERVICIO.md)** - Visión para integrar con la plataforma APIDevs (Next.js + Supabase)
- **[Arquitectura Producto SaaS](../ARQUITECTURA_PRODUCTO_SAAS.md)** - Visión para producto independiente "SignalHub" (SaaS multi-tenant)

---

## 🎯 **¿Qué Documentación Leer?**

### **Si quieres usar el bot ahora:**
👉 Lee el [README Principal](../README.md)
- Setup básico con Telegram
- Screenshots con Puppeteer
- Deploy con Docker

### **Si eres parte del equipo APIDevs:**
👉 Lee [Arquitectura Microservicio APIDevs](../ARQUITECTURA_MICROSERVICIO.md)
- Integración con plataforma existente
- Supabase como backend único
- Multi-tenant para clientes de indicadores

### **Si quieres construir el producto SaaS:**
👉 Lee [Arquitectura Producto SaaS](../ARQUITECTURA_PRODUCTO_SAAS.md)
- Modelo de negocio completo
- Planes de suscripción
- Go-to-market strategy
- Roadmap de features

---

## 🚀 **Quick Start - Bot Actual**

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
nano .env  # Configurar TELEGRAM_BOT_TOKEN, etc.

# 3. Iniciar servidor
npm start

# 4. Acceder al panel admin
# http://localhost:5002/admin
```

---

## 📊 **Comparación de Arquitecturas**

| Feature | Bot Actual | Microservicio APIDevs | Producto SaaS |
|---------|------------|----------------------|---------------|
| **Target** | Usuario único | Clientes de APIDevs | Público general |
| **Base de Datos** | ❌ No tiene | ✅ Supabase | ✅ Supabase |
| **Multi-tenant** | ❌ No | ✅ Sí | ✅ Sí |
| **Dashboard** | ❌ Solo admin | ✅ Next.js integrado | ✅ Next.js completo |
| **Pagos** | ❌ No | Stripe (plataforma) | ✅ Stripe integrado |
| **Analytics** | ❌ No | ✅ Básicos | ✅ Avanzados |
| **Deployment** | Docker simple | Docker + Supabase | Full stack SaaS |
| **Complejidad** | ⭐⭐ Baja | ⭐⭐⭐⭐ Media-Alta | ⭐⭐⭐⭐⭐ Alta |
| **Tiempo desarrollo** | ✅ Ya está hecho | 2-3 semanas | 2-3 meses |

---

## 🔄 **Evolución del Proyecto**

```
FASE 1: Bot Actual (✅ Completado)
├── Single-user Telegram bot
├── Screenshots con Puppeteer
├── Cookies persistentes
└── Docker deployment

FASE 2: Microservicio APIDevs (📋 Planeado)
├── Multi-tenant con Supabase
├── Integración con plataforma Next.js
├── Dashboard de señales
├── Sistema de colas (BullMQ)
└── Storage en Supabase

FASE 3: Producto SaaS (💡 Visión)
├── Landing page pública
├── Planes de suscripción (Stripe)
├── Analytics avanzados
├── White-label B2B
└── Mobile app
```

---

## 📞 **Soporte y Contribuciones**

**Issues:** https://github.com/diazpolanco13/tradingview-telegram-bot/issues  
**Discussions:** https://github.com/diazpolanco13/tradingview-telegram-bot/discussions

---

## 📝 **Notas Importantes**

### **Supabase en Ambas Arquitecturas:**
Tanto el microservicio APIDevs como el producto SaaS usan **Supabase** como backend:
- ✅ PostgreSQL database
- ✅ Auth integrado
- ✅ Storage para screenshots
- ✅ Realtime subscriptions
- ✅ Row Level Security (RLS)

### **Código Reutilizable:**
El bot actual comparte ~60% del código con las versiones futuras:
- ✅ `screenshotService.js` → Directamente reutilizable
- ✅ `cookieManager.js` → Adaptable a multi-tenant
- ✅ Parseo de mensajes → Ya funciona perfecto
- ✅ Docker setup → Base para deploy

---

**Última actualización:** Octubre 2025
