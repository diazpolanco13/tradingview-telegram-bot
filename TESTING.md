# 🧪 Guía Completa de Testing - TradingView Telegram Bot

## 📋 Pre-requisitos

Antes de probar, necesitas:

1. ✅ Bot de Telegram creado (@BotFather)
2. ✅ Canal de Telegram
3. ✅ Cuenta Premium de TradingView (IMPORTANTE)
4. ✅ Cookies de TradingView

---

## 🔑 Paso 1: Obtener Cookies de TradingView

### **¿Por qué cookies y no login?**

```
❌ Login directo → TradingView detecta bot → CAPTCHA/Ban
✅ Cookies persistentes → Sesión normal → Funciona indefinidamente
```

### **¿Qué cookies necesitamos?**

- `sessionid` - Cookie principal de sesión
- `sessionid_sign` - Firma de seguridad (crítico!)

### **Cómo obtener las cookies:**

1. **Abre TradingView**: https://www.tradingview.com
2. **Inicia sesión** con tu cuenta Premium
3. **Abre DevTools** (F12 o Ctrl+Shift+I)
4. **Ve a Application** (o Storage en Firefox)
5. **Expande Cookies** → `https://tradingview.com`
6. **Copia ambas cookies:**
   - `sessionid` → valor completo
   - `sessionid_sign` → valor completo

**Ejemplo:**
```
sessionid: xrkffjz9u0olhx0bjizyppi6oeule2u5
sessionid_sign: v3:fTtjqf47qqv+ududUTTDKl8BfARgn4/hXqBfs2811rw=
```

---

## 🤖 Paso 2: Crear Bot de Telegram

### **1. Hablar con BotFather**

```
1. Abre Telegram
2. Busca: @BotFather
3. Escribe: /newbot
4. Sigue instrucciones
5. Copia el TOKEN
```

**Ejemplo de TOKEN:**
```
123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### **2. Obtener Channel ID**

**Opción A: Canal Público**
```
@mi_canal → simplemente usa: @mi_canal
```

**Opción B: Canal Privado**
```
1. Añade el bot al canal como admin
2. Envía un mensaje al canal
3. Ve a: https://api.telegram.org/bot<TOKEN>/getUpdates
4. Busca "chat":{"id":-1001234567890
5. Usa ese ID (con el signo negativo)
```

---

## ⚙️ Paso 3: Configurar Variables de Entorno

Edita `.env`:

```env
PORT=5002

# Telegram (OBLIGATORIO)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHANNEL_ID=@mi_canal

# TradingView Cookies (SE ACTUALIZAN VÍA PANEL ADMIN)
TV_SESSIONID=
TV_SESSIONID_SIGN=

# Opcional
CHART_LOAD_WAIT=10000
SCREENSHOT_WIDTH=1280
SCREENSHOT_HEIGHT=720
```

---

## 🚀 Paso 4: Iniciar el Bot

```bash
npm start
```

**Deberías ver:**
```
╔════════════════════════════════════════════════════════════╗
║  📱 TradingView Telegram Bot - Running                     ║
║                                                            ║
║  🌐 Server:     http://localhost:5002                   ║
║  🎛️  Admin:      http://localhost:5002/admin            ║
║  📡 Webhook:     http://localhost:5002/webhook          ║
║  ❤️  Health:     http://localhost:5002/health           ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🎛️ Paso 5: Configurar Cookies en el Panel Admin

### **1. Obtener Token de Admin**

```bash
curl http://localhost:5002/admin-token
```

**Respuesta:**
```json
{
  "token": "abce5b8c087c73bb6565aa3a49ea8633c7e7ccb06a383b518987e4da0a78bb38"
}
```

### **2. Actualizar Cookies**

**Opción A: Desde el navegador**
1. Abre: http://localhost:5002/admin
2. Ingresa el token
3. Ve a "Gestión de Cookies"
4. Pega las cookies
5. Click "Actualizar"

**Opción B: Con curl**
```bash
TOKEN="tu_token_aqui"
curl -X POST http://localhost:5002/cookies/update \
  -H "X-Admin-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionid": "xrkffjz9u0olhx0bjizyppi6oeule2u5",
    "sessionid_sign": "v3:fTtjqf47qqv+ududUTTDKl8BfARgn4/hXqBfs2811rw="
  }'
```

### **3. Verificar Cookies**

```bash
curl http://localhost:5002/cookies/status \
  -H "X-Admin-Token: $TOKEN"
```

**Respuesta esperada:**
```json
{
  "valid": true,
  "profile_data": {
    "username": "tu_usuario",
    "balance": 0
  },
  "last_updated": "2025-10-26T23:00:00.000Z"
}
```

---

## 🧪 Paso 6: Testing de Funcionalidades

### **Test 1: Health Check**

```bash
curl http://localhost:5002/health
```

**Esperado:**
```json
{
  "status": "healthy",
  "services": {
    "telegram": true,
    "puppeteer": false  // ⚠️ Normal en localhost sin Docker
  }
}
```

### **Test 2: Webhook GET (Info)**

```bash
curl http://localhost:5002/webhook
```

**Esperado:**
```json
{
  "status": "online",
  "message": "Webhook endpoint está funcionando. Usa POST para enviar alertas."
}
```

### **Test 3: Mensaje Simple (Sin Screenshot)**

```bash
curl -X POST http://localhost:5002/webhook \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "price": "50000", "alert": "Test alert"}'
```

**Esperado:**
- ✅ Mensaje enviado a Telegram
- ✅ JSON formateado visible en el canal

### **Test 4: Mensaje + Screenshot**

⚠️ **SOLO FUNCIONA EN DOCKER** (requiere Chromium)

```bash
curl -X POST "http://localhost:5002/webhook?chart=xyz123&ticker=BTCUSDT&delivery=together" \
  -H "Content-Type: application/json" \
  -d '{"alert": "Buy signal on BTCUSDT"}'
```

**Esperado:**
- ✅ Screenshot del chart capturado
- ✅ Foto enviada a Telegram con el mensaje como caption

---

## 🐳 Paso 7: Testing con Docker (COMPLETO)

### **Build**

```bash
docker build -t telegram-bot .
```

### **Run**

```bash
docker run -d \
  --name telegram-bot \
  -p 5002:5002 \
  -e TELEGRAM_BOT_TOKEN="123456789:ABC..." \
  -e TELEGRAM_CHANNEL_ID="@mi_canal" \
  -e TV_SESSIONID="xrkffjz9..." \
  -e TV_SESSIONID_SIGN="v3:fTt..." \
  telegram-bot
```

### **Test Screenshot en Docker**

```bash
# Obtener Chart ID de TradingView
# 1. Abre un chart en TradingView
# 2. La URL será: https://www.tradingview.com/chart/xyz123/
# 3. "xyz123" es tu Chart ID

curl -X POST "http://localhost:5002/webhook?chart=xyz123&ticker=BTCUSDT" \
  -H "Content-Type: text/plain" \
  -d "🚨 Alerta de compra en BTCUSDT!"
```

**Esperado:**
- ✅ Puppeteer abre TradingView
- ✅ Cookies se inyectan
- ✅ Chart carga con tus indicadores
- ✅ Screenshot se captura
- ✅ Se envía a Telegram

---

## 📊 Paso 8: Configurar Alerta en TradingView

### **1. Crear Alerta**

1. Abre tu chart en TradingView
2. Click en "Alert" (🔔)
3. Configura tu condición
4. En "Notifications":
   - ✅ Marca "Webhook URL"

### **2. Webhook URL**

```
http://tu-servidor.com:5002/webhook?chart=<CHART_ID>&ticker={{ticker}}&delivery=asap
```

**Reemplaza:**
- `tu-servidor.com` → IP o dominio de tu servidor
- `<CHART_ID>` → ID de tu chart (ver URL del chart)
- `{{ticker}}` → Variable de TradingView (se reemplaza automáticamente)

### **3. Message**

```
🚨 *Alerta de {{exchange}}*

📊 Símbolo: `{{ticker}}`
💰 Precio: `{{close}}`
⏰ Timeframe: {{interval}}
📈 Condición: {{plot("Moving Average")}}
```

### **4. Parámetros Query**

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `chart` | ID del chart | `xyz123` |
| `ticker` | Símbolo (usa variable) | `{{ticker}}` |
| `delivery` | `asap` o `together` | `asap` |
| `jsonRequest` | `true` o `false` | `false` |

---

## ✅ Checklist de Verificación

Antes de considerar el bot listo:

- [ ] Telegram Bot creado y token obtenido
- [ ] Canal creado y bot añadido como admin
- [ ] Cookies de TradingView obtenidas
- [ ] Cookies validadas en panel admin
- [ ] Test de mensaje simple (sin screenshot) ✅
- [ ] Docker build exitoso
- [ ] Test de screenshot en Docker ✅
- [ ] Alerta de TradingView configurada
- [ ] Alerta real recibida en Telegram ✅

---

## 🐛 Troubleshooting

### **Error: "Cookies inválidas"**

```
Solución:
1. Verifica que estés logueado en TradingView
2. Copia AMBAS cookies (sessionid Y sessionid_sign)
3. No copies espacios o caracteres extra
4. Las cookies expiran cada ~30 días, renueva si necesario
```

### **Error: "Telegram bot token inválido"**

```
Solución:
1. Verifica el token en @BotFather
2. Asegúrate de copiar el token completo
3. Añade el bot al canal como admin
```

### **Error: "Screenshot timeout"**

```
Solución:
1. Aumenta CHART_LOAD_WAIT en .env
2. Verifica que las cookies sean válidas
3. Asegúrate de estar en Docker (requiere Chromium)
```

### **Error: "Chart no muestra indicadores"**

```
⚠️ ESTE ES EL PROBLEMA QUE MENCIONASTE!

Solución:
1. Las cookies SON la solución
2. Verifica que las cookies estén actualizadas
3. Asegúrate de tener cuenta Premium de TradingView
4. Los indicadores solo se ven si estás logueado
```

---

## 🎯 Diferencia: Con vs Sin Cookies

```
SIN COOKIES (Modo público):
├─ Chart básico de TradingView
├─ Sin indicadores personalizados
├─ Sin drawings/anotaciones
└─ Limitaciones de cuenta gratuita

CON COOKIES (Tu sesión):
├─ ✅ Chart con TUS indicadores
├─ ✅ Drawings y anotaciones visibles
├─ ✅ Configuración de colores
└─ ✅ Todo tal como lo ves en tu navegador
```

**Por eso las cookies son CRÍTICAS** 🔥

---

## 📝 Notas Finales

1. **Cookies duran ~30 días** - Necesitarás renovarlas periódicamente
2. **Panel admin facilita renovación** - No necesitas reiniciar el bot
3. **Screenshots solo en Docker** - Localhost no tiene Chromium
4. **Telegram requiere bot como admin** - Para enviar a canales

---

## 🚀 Deploy a Producción

Cuando todo funcione localmente:

1. Sube el código a GitHub
2. Despliega en Dokploy
3. Configura variables de entorno
4. Actualiza webhook URL en TradingView
5. ✅ Listo!

---

**¿Problemas?** Abre un issue: https://github.com/diazpolanco13/tradingview-telegram-bot/issues

