# 🚀 Guía de Despliegue - Microservicio Trading V2

## 📋 Resumen

Este microservicio está diseñado para desplegarse en **Dockploy** con deployment automático desde GitHub.

---

## 🏗️ Arquitectura de Despliegue

```
GitHub (push) → Dockploy (CI/CD) → Docker Container
                                    ├── Node.js + Express
                                    ├── Redis (incluido)
                                    ├── Puppeteer + Chromium
                                    └── Conexión a Supabase
```

---

## ⚙️ Variables de Entorno Requeridas

### **En Dockploy, configura estas variables:**

```env
# ----- PUERTO (Dockploy lo asigna automáticamente) -----
PORT=3000

# ----- SUPABASE (REQUERIDO) -----
SUPABASE_URL=https://zzieiqxlxfydvexalbsr.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# ----- REDIS (Dockploy lo proporciona) -----
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# ----- ENCRIPTACIÓN (IMPORTANTE: Genera una nueva en producción) -----
ENCRYPTION_KEY=genera_una_key_de_64_caracteres_hex

# ----- SCREENSHOT SETTINGS -----
SCREENSHOT_TIMEOUT=30000
CHART_LOAD_WAIT=10000

# ----- ENVIRONMENT -----
NODE_ENV=production
```

---

## 🔐 Generar ENCRYPTION_KEY

**Importante:** Genera una nueva key para producción:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y úsalo como `ENCRYPTION_KEY` en Dockploy.

---

## 📦 Dockerfile (Ya incluido en el proyecto)

El proyecto incluye un `Dockerfile` optimizado que:

✅ Instala Chromium para Puppeteer  
✅ Configura dependencias de Node.js  
✅ Expone el puerto 3000  
✅ Ejecuta el servidor en modo producción

---

## 🚀 Proceso de Despliegue Automático

### **1. Configurar Dockploy (Una sola vez)**

1. Conecta tu repositorio de GitHub
2. Configura las variables de entorno
3. Asegúrate de que Redis esté habilitado
4. Configura el dominio personalizado

### **2. Desarrollo Local → Producción**

```bash
# 1. Desarrolla localmente
npm run dev:v2

# 2. Prueba tus cambios
# Visita: http://localhost:5002/admin-v2

# 3. Commit y push
git add .
git commit -m "feat: descripción del cambio"
git push origin main

# 4. Dockploy despliega automáticamente ✨
```

---

## 🧪 Diferencias: Local vs Producción

| **Servicio**    | **Local (Desarrollo)**           | **Dockploy (Producción)**     |
|-----------------|----------------------------------|-------------------------------|
| **Redis**       | ⚠️ Opcional (deshabilitado)     | ✅ Siempre disponible         |
| **BullMQ**      | ⚠️ Deshabilitado                 | ✅ Activo con queue           |
| **Puppeteer**   | ⚠️ Sin Chromium                  | ✅ Con Chromium instalado     |
| **Screenshots** | ❌ Deshabilitados                | ✅ Completamente funcionales  |
| **Supabase**    | ✅ Conectado                     | ✅ Conectado                  |
| **API REST**    | ✅ Funcionando                   | ✅ Funcionando                |

---

## 🔍 Verificar Despliegue

### **Health Check:**
```bash
curl https://tu-dominio.com/health
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
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

## 🐛 Troubleshooting en Producción

### **Problema: Redis no conecta**
```bash
# Verificar que Redis esté habilitado en Dockploy
# Variable REDIS_HOST debe ser "redis" (no "localhost")
```

### **Problema: Puppeteer falla**
```bash
# Verificar que el Dockerfile incluye:
RUN apk add --no-cache chromium
```

### **Problema: Screenshots no se generan**
```bash
# 1. Verificar que Redis está funcionando
# 2. Verificar logs del worker en Dockploy
# 3. Verificar que las cookies del usuario están configuradas
```

---

## 📊 Monitoreo en Producción

### **Panel Admin:**
```
https://tu-dominio.com/admin-v2
```

Desde el panel puedes:
- ✅ Ver estado de todos los servicios
- ✅ Verificar cola de BullMQ
- ✅ Probar webhooks
- ✅ Ver señales recientes
- ✅ Consultar configuraciones de usuarios

---

## 🔄 Actualizar en Producción

```bash
# 1. Haz tus cambios localmente
# 2. Prueba todo localmente
# 3. Commit
git add .
git commit -m "fix: descripción del cambio"

# 4. Push (deployment automático)
git push origin main

# 5. Dockploy detecta el cambio y re-despliega
# 6. Verifica: https://tu-dominio.com/health
```

---

## 🎯 Checklist Pre-Deployment

- [ ] ✅ Todas las tablas creadas en Supabase
- [ ] ✅ ENCRYPTION_KEY única generada para producción
- [ ] ✅ SUPABASE_SERVICE_ROLE_KEY configurada
- [ ] ✅ Redis habilitado en Dockploy
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Dominio personalizado configurado (opcional)
- [ ] ✅ Health check responde correctamente

---

## 📚 Documentación Adicional

- **Arquitectura completa:** `ARQUITECTURA_MICROSERVICIO.md`
- **Panel de testing:** `ADMIN_PANEL_V2.md`
- **README principal:** `MICROSERVICIO_V2_README.md`

---

## ✅ Resumen

1. **Desarrollo local:** Funciona SIN Redis (modo simplificado)
2. **Push a GitHub:** Deployment automático en Dockploy
3. **Producción:** Redis + BullMQ + Puppeteer + Supabase 100% funcional
4. **Zero downtime:** Dockploy maneja el deployment sin interrupciones

---

**Creado: 27 de Octubre 2025**  
**Stack: Node.js + Express + Supabase + BullMQ + Redis + Puppeteer + Docker**

