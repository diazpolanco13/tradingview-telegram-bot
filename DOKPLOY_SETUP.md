# 🐳 Configuración de Dokploy - TradingView Telegram Bot

## 📋 Variables de Entorno Requeridas

Para que las **cookies persistan después de cada reinicio**, configura estas variables de entorno en Dokploy:

### Variables Obligatorias

```env
PORT=5002
NODE_ENV=production

# Telegram Bot
TELEGRAM_BOT_TOKEN=8257215317:AAGvfmsjEx_IP4Oh-lb-ETYfyCs4W8ibmsE
TELEGRAM_CHANNEL_ID=@apidevs_alertas

# TradingView Cookies (IMPORTANTES - PERSISTEN EN REINICIO)
TV_SESSIONID=mbddxdl5xlo4lm1uegsatgw0wvxvkc0e
TV_SESSIONID_SIGN=v3:3s1LeZCuH0UXqW5MCDttuz1mtJ2iG4wlfwZmx3xTjM4=

# Screenshot Settings (Opcional)
CHART_LOAD_WAIT=10000
SCREENSHOT_WIDTH=1280
SCREENSHOT_HEIGHT=720
```

---

## 🔑 Cómo Obtener las Cookies de TradingView

1. **Abre TradingView** en tu navegador y loguéate
2. Presiona **F12** (DevTools)
3. Ve a **Application** → **Cookies** → `https://tradingview.com`
4. Busca y copia:
   - `sessionid` → Pega en `TV_SESSIONID`
   - `sessionid_sign` → Pega en `TV_SESSIONID_SIGN`

---

## ⚙️ Pasos en Dokploy

### 1. Crear/Editar el Proyecto

1. Ve a: https://apidevs-api.com:4000
2. Navega a tu proyecto `telegram-alerts`
3. Click en **Settings** o **Environment Variables**

### 2. Agregar Variables de Entorno

Copia y pega las variables de arriba en el panel de Dokploy.

**⚠️ IMPORTANTE:** Asegúrate de copiar correctamente:
- `TV_SESSIONID` (sin comillas)
- `TV_SESSIONID_SIGN` (incluye el `v3:` al inicio)

### 3. Rebuild del Proyecto

Después de agregar las variables:

```bash
# En Dokploy
1. Click en "Rebuild"
2. Espera 3-5 minutos
3. Verifica los logs
```

### 4. Verificar que Funciona

```bash
# Test del webhook
curl -X POST https://alerts.apidevs-api.com/webhook \
  -H "Content-Type: text/plain" \
  -d "🧪 Test desde Dokploy"

# Verificar cookies
curl https://alerts.apidevs-api.com/cookies/status
```

---

## 🔄 Sistema de Persistencia

### Cómo Funciona Ahora

El sistema carga las cookies en este orden:

1. **Prioridad 1:** Variables de entorno (`TV_SESSIONID`, `TV_SESSIONID_SIGN`)
   - ✅ **Persisten en reinicios** de Docker
   - ✅ Configuradas en Dokploy
   - ✅ No se pierden nunca

2. **Prioridad 2 (Fallback):** Archivo `data/cookies.json`
   - ⚠️ Se pierde en reinicios de contenedor
   - Solo para desarrollo local

### Ventajas

✅ **Sin pérdida de cookies** al reiniciar el contenedor  
✅ **Configuración centralizada** en Dokploy  
✅ **Fácil actualización** (solo cambiar variables de entorno)  
✅ **Backup automático** (Dokploy guarda las variables)

---

## 🔄 Renovar Cookies (cuando expiren)

Las cookies de TradingView duran aproximadamente **30 días**. Para renovarlas:

### Método 1: Variables de Entorno (Recomendado)

1. Obtén nuevas cookies del navegador (F12 → Application → Cookies)
2. En Dokploy → Environment Variables:
   - Actualiza `TV_SESSIONID`
   - Actualiza `TV_SESSIONID_SIGN`
3. Click "Save"
4. Reinicia el contenedor (o espera reinicio automático)

### Método 2: Panel Admin

1. Accede a: `https://alerts.apidevs-api.com/admin`
2. En "Actualizar Cookies":
   - Pega nueva `sessionid`
   - Pega nueva `sessionid_sign`
3. Click "Actualizar Cookies"

**⚠️ Nota:** Este método solo funciona hasta el próximo reinicio. Mejor usar Método 1.

---

## 📊 Monitoreo

### Verificar Estado de Cookies

```bash
# Comando simple
curl https://alerts.apidevs-api.com/cookies/status

# Respuesta esperada
{
  "valid": true,
  "profile_data": {
    "balance": 13.44,
    "username": "apidevelopers",
    "partner_status": 1
  },
  "last_updated": "2025-10-27T02:14:45.981Z"
}
```

### Health Check

```bash
curl https://alerts.apidevs-api.com/health

# Respuesta esperada
{
  "status": "healthy",
  "services": {
    "telegram": true,
    "puppeteer": true
  }
}
```

---

## 🐛 Troubleshooting

### Problema: "Cookies inválidas" después de reiniciar

**Causa:** Las variables de entorno no están configuradas en Dokploy.

**Solución:**
1. Verifica que `TV_SESSIONID` y `TV_SESSIONID_SIGN` existen en las variables de entorno
2. Verifica que no tienen espacios adicionales
3. Rebuild del contenedor

### Problema: Screenshots no funcionan

**Causa:** Puppeteer necesita Chromium (se instala en Docker automáticamente).

**Solución:** Ya está resuelto en el Dockerfile. Verifica los logs:

```bash
# En Dokploy logs deberías ver:
✅ Telegram bot inicializado correctamente
✅ Puppeteer: Ready
```

### Problema: No llegan mensajes a Telegram

**Causa:** Bot no tiene permisos en el canal.

**Solución:**
1. Abre Telegram
2. Ve al canal `@apidevs_alertas`
3. Agrega el bot `@apidevs_alert_bot` como administrador

---

## 🎯 Endpoints Disponibles

```
GET  /                    → Info del bot
GET  /health              → Health check
GET  /webhook             → Info del webhook
POST /webhook             → Recibir alertas (PRINCIPAL)
GET  /admin               → Panel admin
GET  /cookies/status      → Estado de cookies
POST /cookies/update      → Actualizar cookies
```

---

## 📝 Checklist de Deployment

- [ ] Variables de entorno configuradas en Dokploy
- [ ] `TV_SESSIONID` y `TV_SESSIONID_SIGN` copiadas correctamente
- [ ] Rebuild completado sin errores
- [ ] Health check responde OK
- [ ] Cookies válidas (verificar con `/cookies/status`)
- [ ] Test de webhook exitoso
- [ ] Mensaje llegó a Telegram
- [ ] Panel admin accesible
- [ ] Dominio configurado (opcional)

---

**Última actualización:** 27 de Octubre 2025  
**Versión:** 1.0.0

