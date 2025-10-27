# 🚀 Inicio Rápido - Microservicio Trading V2

## ⚡ En 5 Minutos

### **1. Clonar e Instalar**
```bash
git clone https://github.com/tu-usuario/tradingview-telegram-bot.git
cd tradingview-telegram-bot
npm install
```

### **2. Configurar .env**
```bash
# Crear archivo .env
cat > .env << 'EOF'
PORT=5002
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
ENCRYPTION_KEY=genera_con_node_crypto
NODE_ENV=development
EOF

# Generar ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copia el resultado y pégalo en .env
```

### **3. Iniciar Servidor**
```bash
npm run dev:v2
```

### **4. Abrir Panel**
```
http://localhost:5002/admin-v2
```

---

## 🎯 Lo Que Verás

### **Panel Admin V2:**
- ✅ Health Check de servicios
- ✅ Test de Supabase
- ✅ Probar webhooks
- ✅ Ver señales recientes
- ✅ Test de encriptación
- ✅ Estadísticas de la cola

### **Servicios Activos:**
- ✅ **Supabase:** Conectado
- ⚠️ **Redis:** Opcional en local (activo en producción)
- ⚠️ **Puppeteer:** Opcional en local (activo en producción)
- ✅ **API REST:** Todos los endpoints funcionando

---

## 📡 Endpoints Disponibles

```bash
# Health Check
curl http://localhost:5002/health

# API Root
curl http://localhost:5002/

# Webhook V2 (requiere token)
curl -X POST http://localhost:5002/webhook/:token \
  -H "Content-Type: application/json" \
  -d '{"ticker":"BTCUSDT","price":45000}'

# Dashboard API (requiere auth)
curl http://localhost:5002/api/signals
```

---

## 🧪 Probar el Sistema

### **1. Obtener un webhook token:**
1. Ve a Supabase Dashboard
2. Abre `trading_signals_config` table
3. Copia un `webhook_token` de un usuario

### **2. Enviar señal de prueba:**
```bash
curl -X POST http://localhost:5002/webhook/TU_TOKEN_AQUI \
  -H "Content-Type: application/json" \
  -d '{
    "indicator": "Test Indicator",
    "ticker": "BINANCE:BTCUSDT",
    "price": 45123.50,
    "signal_type": "BUY",
    "direction": "LONG"
  }'
```

### **3. Ver la señal creada:**
```bash
# Desde el panel admin
http://localhost:5002/admin-v2
# Click en "Get Recent Signals"
```

---

## 🚀 Desplegar a Producción

### **Dockploy (Automático):**
```bash
# 1. Configura variables en Dockploy
# 2. Push a GitHub
git add .
git commit -m "feat: nuevo feature"
git push origin main

# 3. Dockploy despliega automáticamente
# 4. Verifica: https://tu-dominio.com/health
```

Ver guía completa: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📚 Documentación

| **Documento**                  | **Descripción**                           |
|--------------------------------|-------------------------------------------|
| `MICROSERVICIO_V2_README.md`  | Documentación completa del microservicio  |
| `ARQUITECTURA_MICROSERVICIO.md`| Arquitectura y diseño del sistema         |
| `ADMIN_PANEL_V2.md`            | Guía del panel de testing                 |
| `DEPLOYMENT.md`                | Guía de despliegue en Dockploy            |
| `ROADMAP.md`                   | Roadmap y evolución del proyecto          |

---

## 🆘 Problemas Comunes

### **Error: SUPABASE_SERVICE_ROLE_KEY requerida**
```bash
# Obtén la key de:
https://supabase.com/dashboard/project/tu-proyecto/settings/api
# Copia "service_role" key (secret)
```

### **Error: Redis no disponible**
```bash
# En desarrollo local es NORMAL
# Redis solo es requerido en producción
# El servidor funciona sin Redis (sin screenshots)
```

### **Servidor no inicia**
```bash
# Verificar puerto disponible
lsof -i :5002

# Ver logs
npm run dev:v2
```

---

## ✅ Checklist

- [ ] Node.js 18+ instalado
- [ ] Supabase project creado
- [ ] Tablas creadas en Supabase (ver migrations)
- [ ] `.env` configurado
- [ ] `npm install` ejecutado
- [ ] Servidor corriendo en puerto 5002
- [ ] Panel admin accesible

---

## 🎉 ¡Listo!

Ahora tienes un microservicio multi-tenant completo funcionando localmente.

**Siguiente paso:** Integra con tu plataforma Next.js

Ver: [MICROSERVICIO_V2_README.md](./MICROSERVICIO_V2_README.md) sección "Próximos Pasos para Integración con Next.js"

---

**Creado: 27 de Octubre 2025**

