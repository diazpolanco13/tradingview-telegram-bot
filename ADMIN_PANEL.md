# 🎛️ Panel de Testing Admin

## ✅ PANEL COMPLETO IMPLEMENTADO

Hemos creado un **panel de testing profesional** para el microservicio que mantiene **backward compatibility** con tu panel V1 existente.

---

## 🚀 Acceso Rápido

### Panel (Nuevo - Microservicio)
```
http://localhost:3000/admin
```

### Panel V1 (Legacy - Bot Telegram)
```
http://localhost:3000/admin
```

---

## 📋 Características del Panel

### 🎯 **Columna Izquierda:**

1. **❤️ System Health**
   - Estado completo de todos los servicios
   - Supabase, Redis, Puppeteer, BullMQ
   - Uptime del servidor

2. **📊 BullMQ Queue Stats**
   - Jobs en cola (waiting)
   - Jobs activos (active)
   - Jobs completados (completed)
   - Jobs fallidos (failed)

3. **📡 Test Webhook (Multi-tenant)**
   - Prueba el endpoint `/webhook/:token`
   - Envía JSON personalizado
   - Valida tokens de usuario
   - Ve la respuesta en tiempo real

4. **📨 Test Webhook V1 (Legacy)**
   - Prueba el webhook V1 antiguo
   - Envía mensajes a Telegram
   - Backward compatibility

---

### 🎯 **Columna Derecha:**

5. **🗄️ Supabase Connection**
   - Test de conexión completo
   - Cuenta tablas y configuraciones
   - Verifica bucket de storage

6. **👤 User Config (Supabase)**
   - Obtén la configuración de cualquier usuario
   - Ingresa UUID del usuario
   - Ve webhook token, cuotas, cookies (encriptadas)

7. **📊 Recent Signals**
   - Lista las últimas señales capturadas
   - Configurable (limit)
   - Muestra todas las señales del sistema

8. **🔐 Test Encryption**
   - Prueba encriptación AES-256-GCM
   - Encripta y desencripta texto
   - Valida integridad

9. **🍪 Cookie Status (V1 Legacy)**
   - Verifica cookies del bot V1
   - Compatibilidad con sistema anterior

---

### 📚 **Sección de Documentación:**

10. **API Endpoints Documentation**
    - Tabla completa de endpoints
    - Webhook, Dashboard API, System, Legacy V1
    - Códigos de ejemplo

---

## 🛠️ Endpoints de Testing Implementados

### **1. GET `/test/supabase`**
Prueba la conexión a Supabase y obtiene estadísticas.

**Respuesta:**
```json
{
  "success": true,
  "message": "Conexión a Supabase exitosa ✅",
  "stats": {
    "total_configs": 20,
    "total_signals": 0,
    "screenshot_bucket_exists": true,
    "buckets": 1
  }
}
```

---

### **2. GET `/test/user-config/:userId`**
Obtiene la configuración de un usuario específico.

**Ejemplo:**
```bash
GET /test/user-config/123e4567-e89b-12d3-a456-426614174000
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "webhook_token": "abc123...",
    "webhook_enabled": true,
    "signals_quota": 100,
    "signals_used_this_month": 5,
    "cookies_valid": true,
    "tv_sessionid": "[ENCRYPTED - Hidden for security]",
    "screenshot_resolution": "1080p"
  }
}
```

---

### **3. GET `/test/signals?limit=10`**
Obtiene señales recientes del sistema.

**Respuesta:**
```json
{
  "success": true,
  "total": 0,
  "limit": 10,
  "data": []
}
```

---

### **4. POST `/test/encryption`**
Prueba la encriptación y desencriptación.

**Body:**
```json
{
  "text": "my_secret_cookie_value"
}
```

**Respuesta:**
```json
{
  "success": true,
  "original": "my_secret_cookie_value",
  "encrypted": "a1b2c3d4e5f6...",
  "encrypted_length": 256,
  "decrypted": "my_secret_cookie_value",
  "validation": "✅ OK"
}
```

---

### **5. GET `/test/database-stats`**
Estadísticas generales de la base de datos.

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "total_users_with_config": 20,
    "total_signals": 0,
    "total_stats_records": 20,
    "screenshots": {
      "pending": 0,
      "completed": 0,
      "failed": 0
    },
    "top_users": []
  }
}
```

---

### **6. POST `/test/create-test-signal`**
Crea una señal de prueba para un usuario.

**Body:**
```json
{
  "user_id": "uuid-del-usuario"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Señal de prueba creada ✅",
  "data": { ... }
}
```

---

### **7. DELETE `/test/clear-test-signals`**
Elimina todas las señales de prueba del sistema.

**Respuesta:**
```json
{
  "success": true,
  "message": "Señales de prueba eliminadas ✅"
}
```

---

## 🎨 Interfaz del Panel

### **Diseño:**
- ✅ Dark mode profesional (Tailwind CSS)
- ✅ Layout de 2 columnas responsivo
- ✅ Códigos de color por sección
- ✅ Pre-formateado para JSON
- ✅ Scroll independiente por sección

### **Colores:**
- 🔴 Rojo: System Health
- 🟠 Naranja: Queue Stats
- 🟣 Púrpura: Webhook
- 🔵 Azul: Webhook V1 Legacy
- 🟢 Verde: Supabase
- 🔵 Cyan: User Config
- 🟡 Amarillo: Signals
- 🟣 Rosa: Encryption
- 🟢 Verde: Cookies V1

---

## 🧪 Flujo de Prueba Completo

### **Paso 1: Verificar Salud del Sistema**
1. Abre `http://localhost:3000/admin`
2. Click en "Check Health"
3. Verifica que todos los servicios estén ✅

### **Paso 2: Probar Supabase**
1. Click en "Test Connection" en la sección Supabase
2. Verifica conteos de tablas
3. Confirma que el bucket existe

### **Paso 3: Obtener un Usuario de Prueba**
1. Ve a Supabase Dashboard
2. Copia el UUID de un usuario
3. Pégalo en "User Config"
4. Click "Get Config"
5. Copia el `webhook_token`

### **Paso 4: Probar Webhook**
1. Pega el `webhook_token` en la sección Webhook
2. Modifica el JSON si quieres
3. Click "Enviar al Webhook"
4. Verifica respuesta exitosa con `signal_id`

### **Paso 5: Ver Señales Recientes**
1. En "Recent Signals", deja limit en 10
2. Click "Get Recent Signals"
3. Deberías ver la señal que acabas de crear

### **Paso 6: Ver Stats de la Cola**
1. Click "Ver Estadísticas" en BullMQ
2. Observa los jobs en cola/completados

### **Paso 7: Probar Encriptación**
1. Ingresa un texto cualquiera
2. Click "Encrypt & Decrypt"
3. Verifica que la validación sea ✅ OK

---

## 🔄 Comparación V1 vs

| **Feature**                  | **V1 (Legacy)**       | **(Nuevo)**           |
|------------------------------|-----------------------|--------------------------|
| URL                          | `/admin`              | `/admin`              |
| Cookie Management            | ✅ Sí                 | ✅ Sí (Legacy section)   |
| Test Telegram Webhook        | ✅ Sí                 | ✅ Sí (V1 section)       |
| Test Webhook Multi-tenant | ❌ No                 | ✅ Sí                    |
| Supabase Testing             | ❌ No                 | ✅ Sí                    |
| Queue Stats (BullMQ)         | ❌ No                 | ✅ Sí                    |
| User Config Lookup           | ❌ No                 | ✅ Sí                    |
| Recent Signals View          | ❌ No                 | ✅ Sí                    |
| Encryption Testing           | ❌ No                 | ✅ Sí                    |
| Database Stats               | ❌ No                 | ✅ Sí                    |
| API Documentation            | ❌ No                 | ✅ Sí                    |

---

## 📱 Screenshots del Panel

El panel tiene un diseño profesional con:

- **Header**: Título grande con badges de servicios activos
- **Grid 2 columnas**: Izquierda (testing), Derecha (consultas)
- **Secciones con colores**: Cada sección tiene su propio color distintivo
- **Pre JSON**: Todos los resultados se muestran formateados
- **Botones coloridos**: Fácil identificación de acciones
- **Footer con docs**: Tabla completa de endpoints disponibles

---

## 🚀 Cómo Usar

### **Iniciar el Servidor:**
```bash
npm run dev
```

### **Acceder al Panel:**
```bash
# Panel (Nuevo)
http://localhost:3000/admin

# Panel V1 (Legacy)
http://localhost:3000/admin
```

### **Probar Health Check:**
```bash
curl http://localhost:3000/health
```

---

## 🎯 Casos de Uso

### **1. Desarrollador Frontend (Next.js)**
- Usa el panel para obtener webhook tokens
- Prueba endpoints de API
- Ve ejemplos de respuestas

### **2. DevOps / Infraestructura**
- Monitorea salud del sistema
- Ve estadísticas de la cola
- Verifica conexiones a servicios

### **3. Testing / QA**
- Crea señales de prueba
- Valida encriptación
- Prueba webhooks sin TradingView

### **4. Soporte Técnico**
- Consulta configuración de usuarios
- Ve señales recientes
- Diagnostica problemas

---

## 🔧 Personalización

### **Agregar Más Tests:**

Edita `src/routes/admin.js`:
```javascript
router.get('/test/mi-nuevo-test', async (req, res) => {
  // Tu código aquí
});
```

Edita `public/admin.html`:
```html
<button onclick="miNuevoTest()">Test</button>

<script>
async function miNuevoTest() {
  const response = await fetch('/test/mi-nuevo-test');
  const data = await response.json();
  // Mostrar resultado
}
</script>
```

---

## 📚 Documentación de Referencia

- **Archivo HTML**: `public/admin.html`
- **Rutas Backend**: `src/routes/admin.js`
- **Servidor**: `src/server.js`

---

## ✅ Resumen

Has pasado de un simple panel de cookies a un **dashboard de testing completo** que:

- ✅ Mantiene compatibilidad con V1
- ✅ Agrega 8+ endpoints de testing
- ✅ Interfaz moderna y profesional
- ✅ Documentación integrada
- ✅ Testeo de todos los servicios
- ✅ Fácil de usar y expandir

**¡Tu panel está listo para testear todo el microservicio!** 🎉

---

**Creado: 27 de Octubre 2025**  
**Versión: 2.0.0**

