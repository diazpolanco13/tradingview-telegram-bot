# 🏗️ Arquitectura: Microservicio de Alertas Trading

> **Documento de Arquitectura** - API para Plataforma de Indicadores APIDevs

---

## 🎯 **Objetivo**

Convertir el bot de Telegram en un **microservicio de API** que:
- Recibe alertas de TradingView de múltiples usuarios
- Captura screenshots personalizados por usuario
- Almacena señales en base de datos estructurada
- Expone API REST para la plataforma web principal
- Escala a 1000+ usuarios concurrentes

---

## 📊 **Modelo de Negocio**

### **Estructura:**
```
PLATAFORMA PRINCIPAL (APIDevs Web)
├── Venta de indicadores personalizados
├── Dashboard de señales (frontend React/Next.js)
├── Gestión de usuarios y suscripciones
└── Analytics y estadísticas

MICROSERVICIO DE ALERTAS (Este proyecto)
├── API REST para webhooks de TradingView
├── Captura de screenshots en background
├── Almacenamiento de señales en DB
└── Sistema de colas para procesamiento asíncrono
```

### **Flujo del Usuario:**
1. Usuario compra indicador en la plataforma
2. Usuario configura alerta en TradingView con su webhook personalizado
3. Alertas llegan al microservicio
4. Microservicio guarda en DB y captura screenshot
5. Plataforma web consume la API para mostrar señales en dashboard
6. Usuario ve todo organizado en su cuenta

---

## 🏛️ **Arquitectura del Sistema**

### **Componentes Principales:**

```
┌─────────────────────────────────────────────────────────┐
│  PLATAFORMA PRINCIPAL (Vercel/Next.js)                  │
│  - Frontend: Dashboard de señales                        │
│  - Backend: Autenticación, usuarios, suscripciones     │
│  - Base de datos: Supabase/PostgreSQL                    │
└─────────────────────────────────────────────────────────┘
                    ↓ API Calls
┌─────────────────────────────────────────────────────────┐
│  MICROSERVICIO DE ALERTAS (Docker/Kubernetes)           │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │  API Gateway (Express)                  │           │
│  │  - Webhook endpoint: /webhook/u/:token  │           │
│  │  - Health check: /health                 │           │
│  │  - Rate limiting por usuario             │           │
│  │  - Validación rápida                     │           │
│  │  - Response < 100ms                      │           │
│  └──────────────────────────────────────────┘           │
│                    ↓                                     │
│  ┌──────────────────────────────────────────┐           │
│  │  Message Processor                       │           │
│  │  - Parsea mensaje estandarizado          │           │
│  │  - Extrae ticker automáticamente         │           │
│  │  - Valida formato requerido              │           │
│  │  - Guarda en DB inmediatamente            │           │
│  └──────────────────────────────────────────┘           │
│                    ↓                                     │
│  ┌──────────────────────────────────────────┐           │
│  │  Screenshot Queue (BullMQ + Redis)       │           │
│  │  - Cola de trabajos de captura           │           │
│  │  - Prioridad por plan (premium > pro)   │           │
│  │  - Retry automático en caso de error     │           │
│  │  - Rate limiting inteligente             │           │
│  └──────────────────────────────────────────┘           │
│                    ↓                                     │
│  ┌──────────────────────────────────────────┐           │
│  │  Screenshot Workers Pool                 │           │
│  │  - Workers con Puppeteer                 │           │
│  │  - Concurrency: 3 por worker              │           │
│  │  - 10 workers iniciales (30 simultáneos) │           │
│  │  - Auto-scaling hasta 20 workers         │           │
│  │  - Usa cookies del usuario específico    │           │
│  └──────────────────────────────────────────┘           │
│                    ↓                                     │
│  ┌──────────────────────────────────────────┐           │
│  │  Storage Layer                           │           │
│  │  - Cloudflare R2 o S3                    │           │
│  │  - CDN para delivery rápido              │           │
│  │  - URLs públicas con expiración          │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  BASE DE DATOS (PostgreSQL)                              │
│                                                          │
│  Tablas:                                                 │
│  - users (usuarios con webhook tokens)                  │
│  - signals (señales recibidas, formato estandarizado)   │
│  - screenshots (metadatos de imágenes)                   │
│  - user_config (configuración por usuario)             │
│  - audit_logs (traza de webhooks recibidos)             │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 **Sistema Multi-Tenant**

### **Individualización por Usuario:**

Cada usuario tiene:
- **Webhook token único:** `https://api.apidevs.com/webhook/u/abc123`
- **Cookies propias de TradingView:** Para capturar SUS charts
- **Chart ID personalizado:** Donde guarda sus indicadores
- **Configuración independiente:** Preferencias y límites

### **Flujo de una Alert:**

1. **Usuario configura en TradingView:**
   ```
   Webhook: https://api.apidevs.com/webhook/u/USER_TOKEN?chart=CHART_ID
   ```

2. **Alert dispara → API recibe:**
   ```json
   {
     "user_token": "abc123",
     "chart_id": "Q7w5R5x8",
     "message": "🪙 Ticker: BINANCE:BTCUSDT\n💰 $67,890..."
   }
   ```

3. **API identifica usuario por token:**
   - Busca usuario en DB
   - Valida plan y límites
   - Verifica cookies válidas

4. **Procesamiento inmediato (< 100ms):**
   - Parsea mensaje estandarizado
   - Guarda en tabla `signals`
   - Encola screenshot
   - Responde 200 OK

5. **Screenshot en background (20-25 seg):**
   - Worker toma cola
   - Abre chart con cookies del usuario
   - Captura screenshot
   - Sube a S3/R2
   - Actualiza DB con URL

---

## 🗄️ **Modelo de Datos**

### **Tabla: signals**
```sql
- id (UUID)
- user_id (FK a users)
- indicator (VARCHAR) - "ADX DEF [APIDEVS]"
- ticker (VARCHAR) - "BINANCE:BTCUSDT"
- exchange (VARCHAR) - "BINANCE"
- symbol (VARCHAR) - "BTCUSDT"
- price (DECIMAL)
- signal_type (VARCHAR) - "Divergencia Alcista"
- chart_id (VARCHAR)
- screenshot_url (TEXT)
- screenshot_status (ENUM) - pending/processing/completed/failed
- timestamp (TIMESTAMP)
- result (ENUM) - pending/win/loss/skip
- profit_loss (DECIMAL)
- notes (TEXT)
- created_at, updated_at
```

### **Tabla: users**
```sql
- id (UUID)
- webhook_token (VARCHAR UNIQUE)
- plan (VARCHAR) - free/pro/premium
- signals_quota (INTEGER)
- signals_used (INTEGER)
- quota_reset_at (TIMESTAMP)
- webhook_enabled (BOOLEAN)
- webhook_last_used (TIMESTAMP)
```

### **Tabla: user_config**
```sql
- user_id (FK)
- tv_sessionid (ENCRYPTED)
- tv_sessionid_sign (ENCRYPTED)
- tv_cookies_valid (BOOLEAN)
- tv_cookies_updated_at (TIMESTAMP)
- default_chart_id (VARCHAR)
- notification_preferences (JSON)
```

---

## 🔄 **Sistema de Colas**

### **Filosofía:**
- **API response ultra-rápido:** Guarda señal en DB, responde inmediatamente
- **Screenshots procesados en background:** No bloquea la API
- **Prioridad por plan:** Premium procesa antes que free

### **Configuración de Cola:**
```
Queue: screenshot-processing
├── Concurrency: 3 screenshots por worker
├── Workers iniciales: 10
├── Auto-scale hasta: 20 workers
├── Timeout por job: 30 segundos
├── Retry: 3 intentos
└── Backoff: Exponencial (2s, 4s, 8s)
```

### **Prioridades:**
- 1: Premium (procesa primero)
- 2: Pro
- 3: Basic
- 4: Free

---

## 📡 **API Endpoints**

### **Webhook (Principal)**
```
POST /webhook/u/:token
Query: ?chart=CHART_ID
Body: Mensaje de alerta

Response < 100ms:
{
  "success": true,
  "signal_id": "uuid",
  "screenshot_status": "processing",
  "estimated_wait": 25
}
```

### **Health Check**
```
GET /health
Response:
{
  "status": "healthy",
  "queue_length": 45,
  "active_workers": 10,
  "uptime": 123456
}
```

### **Estadísticas (para plataforma web)**
```
GET /api/users/:id/stats
Auth: Bearer token
Response:
{
  "total_signals": 1247,
  "this_month": 127,
  "screenshots_pending": 3,
  "win_rate": 68.5
}
```

---

## 🚀 **Despliegue**

### **Infraestructura:**
- **Contenedores:** Docker
- **Orquestación:** Kubernetes o Docker Compose
- **Load Balancer:** NGINX/Traefik
- **Base de datos:** PostgreSQL (managed)
- **Cache/Colas:** Redis (managed)
- **Storage:** Cloudflare R2 o AWS S3
- **CDN:** Cloudflare

### **Escalado:**
- **Horizontal:** Más réplicas de API
- **Workers:** Auto-scaling según cola
- **Database:** Read replicas
- **Storage:** CDN global

---

## 🔐 **Seguridad**

### **Por token de webhook:**
- Token único e irrevocable por usuario
- Rate limiting por usuario
- Validación de formato estandarizado
- Auditoría de todas las llamadas

### **Datos sensibles:**
- Cookies de TradingView encriptadas en DB
- Tokens rotables
- Audit logs completos
- IP whitelist opcional

---

## 📊 **Monitoreo y Observabilidad**

### **Métricas clave:**
- Webhooks recibidos/minuto
- Tiempo de respuesta API (< 100ms target)
- Longitud de cola de screenshots
- Workers activos
- Tasa de éxito de screenshots
- Uso de storage

### **Alertas:**
- Cola > 200 jobs
- API response time > 500ms
- Screenshot failure rate > 10%
- Base de datos lenta

---

## 🎯 **Capacidad del Sistema**

### **Configuración inicial (1000 usuarios):**
```
API Instances: 3
Screenshot Workers: 10-20 (auto-scale)
Concurrency: 3 por worker
Capacidad: ~90 screenshots/minuto
```

### **En picos:**
- Sistema detecta cola > 100
- Auto-escala a 20 workers
- Procesa 60 screenshots simultáneos
- Recuperación en 10-15 minutos

---

## 🔄 **Integración con Plataforma Web**

### **Flujo de consumo:**

1. **Usuario entra a dashboard:**
   - Frontend hace: `GET /api/signals?user_id=abc`

2. **API interna consulta microservicio:**
   ```
   GET https://alertas.api.apidevs.com/api/users/abc/signals
   ```

3. **Microservicio consulta DB:**
   ```sql
   SELECT * FROM signals 
   WHERE user_id = 'abc' 
   ORDER BY created_at DESC
   ```

4. **Frontend muestra:**
   - Tabla de señales
   - Screenshots inline
   - Filtros y búsqueda

### **WebSockets (opcional):**
```
Usuario conectado → WebSocket activo
Nueva señal → Push notification real-time
Actualizar UI automáticamente
```

---

## 🎨 **Ventajas de esta Arquitectura**

### **Escalabilidad:**
- API independiente de workers
- Workers escalan independientemente
- Base de datos compartida pero indexada
- Storage en CDN global

### **Mantenibilidad:**
- Código del bot reutilizable
- Agregar nuevos indicadores = solo config
- Tests unitarios por componente
- Deploy independiente

### **Performance:**
- Response API < 100ms
- Screenshots en background
- Cache de imágenes en CDN
- Queries optimizadas con índices

### **Reliability:**
- Retry automático en fallos
- Workers se reinician solos
- Backup automático de DB
- Monitoring 24/7

---

## 🚀 **Fases de Implementación**

### **Fase 1: Migración (Semana 1-2)**
- Extraer lógica del bot actual
- Crear API REST
- Base de datos multi-tenant
- Deploy en producción

### **Fase 2: Sistema de colas (Semana 3)**
- Implementar BullMQ + Redis
- Workers de screenshots
- Prioridades por plan
- Auto-scaling

### **Fase 3: Integración (Semana 4)**
- Consumir desde plataforma web
- Dashboard de señales
- Filtros y búsqueda
- Estadísticas básicas

### **Fase 4: Optimización (Mes 2)**
- CDN para screenshots
- Cache de queries frecuentes
- WebSockets real-time
- Analytics avanzados

---

## 💡 **Consideraciones Técnicas**

### **Límite de conecciones de Puppeteer:**
- Chromium es pesado (200MB RAM)
- Pool de browsers reutilizables
- Timeout agresivo (30s)
- Cleanup automático

### **Cookies por usuario:**
- Cada screenshot usa cookies del usuario
- Las cookies se guardan por usuario
- Validación periódica de validez
- Renovación manual

### **Formato de mensaje:**
- Estándar definido por indicadores
- Parseo robusto con validación
- Logs de errores para debugging
- Fallback graceful

---

## 📋 **Checklist Técnico**

- [ ] Extraer código actual en clases reutilizables
- [ ] Crear API REST con Express
- [ ] Diseñar modelo de base de datos
- [ ] Implementar autenticación por token
- [ ] Sistema de colas con BullMQ
- [ ] Workers de screenshots
- [ ] Storage en S3/R2
- [ ] Integración con plataforma web
- [ ] Monitoring y alertas
- [ ] Tests unitarios
- [ ] Documentación de API

---

**Este microservicio será el corazón de la plataforma de gestión de alertas, convirtiendo el bot actual en una API profesional y escalable.**

