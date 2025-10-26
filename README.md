# 📱 TradingView Telegram Bot - Node.js

> **Reimplementación superior** del bot de Python para enviar alertas de TradingView con screenshots de charts a Telegram

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 **¿Qué hace este bot?**

Recibe alertas de TradingView vía webhook y las envía a tu canal de Telegram con:
- ✅ Mensaje formateado (texto o JSON)
- ✅ Screenshot automático del chart
- ✅ Soporte para múltiples tickers
- ✅ Delivery modes (instant/together)

---

## 🚀 **Ventajas sobre el Original (Python)**

| Feature | Python Original | **Este Proyecto (Node.js)** |
|---------|----------------|----------------------------|
| **Autenticación** | ❌ Login directo (detectable) | ✅ **Cookies persistentes** |
| **Cookies** | 1 cookie | ✅ **2 cookies (sessionid + sign)** |
| **Screenshots** | Selenium | ✅ **Puppeteer (3x más rápido)** |
| **Admin Panel** | ❌ No | ✅ **Panel web completo** |
| **Deployment** | Replit | ✅ **Docker + Dokploy** |
| **Performance** | ~5-10 seg/screenshot | ✅ **~3-5 seg** |

---

## 📋 **Requisitos**

- Node.js 18+
- Bot de Telegram (obtener token de @BotFather)
- Cuenta Premium de TradingView
- Docker (opcional, para deployment)

---

## 🔧 **Instalación Rápida**

### **1. Clonar e Instalar**

```bash
git clone https://github.com/diazpolanco13/tradingview-telegram-bot.git
cd tradingview-telegram-bot
npm install
```

### **2. Configurar Variables de Entorno**

Edita `.env`:

```env
PORT=5002

# Telegram (obligatorio)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHANNEL_ID=@tu_canal o -1001234567890

# TradingView Cookies (actualizar manualmente)
TV_SESSIONID=tu_sessionid
TV_SESSIONID_SIGN=tu_sessionid_sign
```

### **3. Obtener Cookies de TradingView**

1. Abre TradingView y loguéate
2. Presiona `F12` (DevTools)
3. Ve a `Application` → `Cookies` → `https://tradingview.com`
4. Copia:
   - `sessionid` → TV_SESSIONID
   - `sessionid_sign` → TV_SESSIONID_SIGN

### **4. Iniciar el Bot**

```bash
npm start
```

El bot estará corriendo en: `http://localhost:5002`

---

## 📡 **Uso: Configurar Alerta en TradingView**

### **Webhook URL:**

```
http://tu-servidor.com:5002/webhook?chart=CHART_ID&ticker=BTCUSDT&delivery=asap
```

### **Parámetros Query:**

| Parámetro | Tipo | Descripción | Default |
|-----------|------|-------------|---------|
| `chart` | string | ID del chart de TradingView | - |
| `ticker` | string | Símbolo del ticker (opcional) | - |
| `delivery` | string | `asap` (mensaje primero) o `together` | `together` |
| `jsonRequest` | boolean | Formato JSON en tabla | `false` |

### **Ejemplo de Alerta:**

**En TradingView Alert:**
- **Webhook URL:** `http://tu-servidor.com:5002/webhook?chart=xyz123&ticker={{ticker}}&delivery=asap`
- **Message:**
```
🚨 Alerta de {{exchange}}
Ticker: {{ticker}}
Precio: {{close}}
Timeframe: {{interval}}
```

---

## 🎛️ **Administración**

### **Panel Admin**

Accede a: `http://localhost:5002/admin`

**Funcionalidades:**
- ✅ Actualizar cookies de TradingView
- ✅ Verificar estado de cookies
- ✅ Ver logs del sistema
- ✅ Probar endpoints

### **Obtener Token Admin:**

```bash
npm run get-token
```

O accede a: `http://localhost:5002/admin-token` (solo localhost)

---

## 🐳 **Deployment con Docker**

### **1. Build**

```bash
docker build -t tradingview-telegram-bot .
```

### **2. Run**

```bash
docker run -d \
  --name telegram-bot \
  -p 5002:5002 \
  -e TELEGRAM_BOT_TOKEN=tu_token \
  -e TELEGRAM_CHANNEL_ID=tu_canal \
  -e TV_SESSIONID=tu_sessionid \
  -e TV_SESSIONID_SIGN=tu_sessionid_sign \
  tradingview-telegram-bot
```

### **3. Dokploy (Recomendado)**

1. Crea nuevo proyecto en Dokploy
2. Conecta este repositorio
3. Configura variables de entorno
4. Deploy automático ✅

---

## 📊 **Arquitectura**

```
tradingview-telegram-bot/
├── src/
│   ├── server.js              # Express server
│   ├── services/
│   │   ├── screenshotService.js    # Puppeteer screenshots
│   │   └── telegramService.js      # Telegram bot API
│   ├── utils/
│   │   ├── cookieManager.js        # TradingView auth
│   │   └── logger.js               # Winston logging
│   └── routes/
│       ├── webhook.js              # POST /webhook
│       └── admin.js                # Panel admin
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🔐 **Seguridad**

### **Cookies Persistentes (Ventaja Clave)**

A diferencia del proyecto original en Python que usa login directo (detectable por TradingView), este proyecto usa **cookies de sesión manuales**:

✅ **No hace login automático** → TradingView no detecta bot  
✅ **Sesión persistente** → Funciona indefinidamente  
✅ **2 cookies** → Más seguro que solo sessionid  

### **Renovación de Cookies**

Las cookies duran ~30 días. Para renovar:
1. Accede al panel admin
2. Obtén nuevas cookies del navegador
3. Actualiza en el panel
4. ✅ Listo

---

## 📚 **Endpoints Disponibles**

### **Webhook (Principal)**

```
POST /webhook
Query Params: chart, ticker, delivery, jsonRequest
```

### **Health Check**

```
GET /health
```

### **Admin Panel**

```
GET /admin
```

### **Cookie Management**

```
GET  /admin/cookies/status    (verificar cookies)
POST /admin/cookies/update    (actualizar cookies)
```

---

## 🧪 **Testing**

### **Test Básico:**

```bash
curl http://localhost:5002/health
```

### **Test Webhook:**

```bash
curl -X POST "http://localhost:5002/webhook?delivery=asap" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "price": "50000", "alert": "Test alert"}'
```

---

## 🐛 **Troubleshooting**

### **Error: "Cookies inválidas"**

- Verifica que copiaste correctamente `sessionid` y `sessionid_sign`
- Asegúrate de estar logueado en TradingView
- Renueva las cookies en el panel admin

### **Error: "Screenshot timeout"**

- Aumenta `CHART_LOAD_WAIT` en `.env`
- Verifica que el chart ID es correcto
- Comprueba que las cookies son válidas

### **Error: "Telegram bot token inválido"**

- Verifica el token en @BotFather
- Asegúrate de que el bot está agregado al canal
- Comprueba que el CHANNEL_ID es correcto

---

## 💰 **Modelo de Negocio**

Este proyecto puede ser:

### **Producto SaaS (B2C)**
```
💰 $29-99/mes por usuario
✅ Alertas personales de TradingView
✅ Screenshots automáticos
✅ Multi-canal support
```

### **Herramienta Interna**
```
✅ Para tu propio trading
✅ Para tu equipo/comunidad
✅ Para tus clientes premium
```

---

## 📖 **Documentación Adicional**

- [Guía de Admin](docs/ADMIN_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API_REFERENCE.md)

---

## 🤝 **Créditos**

- **Original:** [trendoscope-algorithms/Tradingview-Telegram-Bot](https://github.com/trendoscope-algorithms/Tradingview-Telegram-Bot) (Python)
- **Reimplementación:** diazpolanco13 (Node.js) - **Versión superior con cookies persistentes**

---

## 📝 **Licencia**

MIT License - Ver [LICENSE](LICENSE)

---

## 🚀 **Roadmap**

- [ ] Multi-channel support (varios canales Telegram)
- [ ] Screenshot personalizado (indicadores, timeframes)
- [ ] Formateo avanzado de mensajes
- [ ] Dashboard de métricas
- [ ] Integración con Discord
- [ ] Mobile app companion

---

## ⭐ **Si te gusta este proyecto, dale una estrella!**

**¿Preguntas? Abre un issue:** https://github.com/diazpolanco13/tradingview-telegram-bot/issues
