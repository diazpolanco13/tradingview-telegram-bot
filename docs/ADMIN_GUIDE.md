# ⚙️ Guía de Administración - TradingView Access Management API

## 🎯 Información Crítica para Administradores

**Versión del Sistema**: 2.3.1
**Arquitectura**: Node.js + Express + PM2 Clustering
**Rendimiento**: 4.6 ops/seg garantizadas
**Disponibilidad**: 99.9%+ con clustering

---

## 🚀 Inicio Rápido para Administradores

### Instalación Básica

```bash
# 1. Instalar dependencias del sistema
sudo apt update
sudo apt install -y nodejs npm pm2

# 2. Clonar y configurar
git clone <repo-url>
cd pinescript-control-access
npm install

# 3. Configurar entorno
cp .env.example .env
nano .env  # Configurar credenciales

# 4. Iniciar con PM2
npm run start:cluster
```

### Verificación de Instalación

```bash
# Verificar servicios
pm2 list
pm2 logs tradingview-api

# Test básico
curl http://localhost:5001/
curl -H "X-API-Key: your_key" "http://localhost:5001/api/metrics/stats"
```

---

## 🔐 Gestión de Tokens y Acceso

### Obtener Token de Administrador

#### Método 1: Endpoint Remoto con X-API-Key (⭐ Recomendado)
```bash
curl -H "X-API-Key: your_api_key" http://your-server:5001/admin/get-token
```

**Ventajas:**
- ✅ Accesible desde cualquier lugar
- ✅ Seguro (requiere X-API-Key)
- ✅ Funciona desde móvil/tablet

#### Método 2: Comando Local NPM
```bash
npm run get-token
```

#### Método 3: Endpoint Local (Solo localhost)
```bash
curl http://localhost:5001/admin-token
```

#### Método 4: Archivo Directo
```bash
cat admin-token.txt
```

### Panel de Administración

1. **Acceder al panel:**
   ```
   http://your-server:5001/admin
   ```

2. **Iniciar sesión:**
   - Pegar el token obtenido
   - Hacer clic en "Acceder al Panel"

3. **Funciones disponibles:**
   - 📊 Ver métricas en tiempo real
   - 🔍 Buscar usuarios y accesos
   - ⚙️ Configurar parámetros del sistema
   - 📝 Ver logs de operaciones

---

## 📊 Monitoreo y Métricas

### Métricas en Tiempo Real

```bash
# Estadísticas generales
curl -H "X-API-Key: your_key" "http://localhost:5001/api/metrics/stats"

# Respuesta esperada:
{
  "totalRequests": 1250,
  "successRate": 98.5,
  "averageResponseTime": 245,
  "activeUsers": 150,
  "totalAccessGranted": 3200,
  "systemHealth": "healthy"
}
```

### Health Check Avanzado

```bash
curl -H "X-API-Key: your_key" "http://localhost:5001/api/metrics/health"
```

**Métricas críticas a monitorear:**
- `successRate`: Debe ser >95%
- `averageResponseTime`: Debe ser <500ms
- `systemHealth`: Debe ser "healthy"

### Dashboard en Terminal

```bash
# Script de monitoreo continuo
watch -n 30 'curl -s -H "X-API-Key: your_key" \
  http://localhost:5001/api/metrics/stats | jq'
```

---

## 🔧 Gestión del Sistema

### PM2 Process Management

```bash
# Ver estado de procesos
pm2 list
pm2 status

# Ver logs en tiempo real
pm2 logs tradingview-api
pm2 logs tradingview-api --lines 100

# Reiniciar servicios
pm2 restart tradingview-api
pm2 reload tradingview-api

# Verificar clustering
pm2 show tradingview-api
```

### Configuración de Clustering

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tradingview-api',
    script: 'src/server.js',
    instances: 2,  // Número de instancias
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    // Auto-restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log'
  }]
};
```

### Backup y Recovery

```bash
# Backup de configuración
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  .env \
  admin-token.txt \
  logs/ \
  data/

# Backup de base de datos (si aplica)
pg_dump tradingview_db > backup-$(date +%Y%m%d).sql

# Restaurar backup
tar -xzf backup-20251026.tar.gz
```

---

## 🔒 Seguridad y Configuración

### Gestión de IPs Permitidas

```bash
# Ver IPs configuradas
grep ALLOWED_IPS .env

# Actualizar IP dinámica
NEW_IP=$(curl -s https://api.ipify.org)
sed -i "s/OLD_IP/$NEW_IP/" .env
pm2 restart tradingview-api

# Desactivar validación por IP (solo desarrollo)
echo "ALLOWED_IPS=" >> .env
pm2 restart tradingview-api
```

### Rate Limiting Configuration

```javascript
// En .env
RATE_LIMIT_WINDOW=900000        # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100     # 100 requests por ventana
BULK_RATE_LIMIT_MAX=5           # 5 operaciones bulk por ventana

// Rate limits por endpoint
GENERAL_ENDPOINTS: 100 req/15min
BULK_ENDPOINTS: 5 req/15min
VALIDATION_ENDPOINTS: 200 req/15min
```

### Gestión de Credenciales TradingView

```bash
# Configurar credenciales (test)
curl -X POST "http://localhost:5001/api/config/tradingview" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tu_usuario_tv",
    "password": "tu_password",
    "testOnly": true
  }'

# Guardar credenciales
curl -X POST "http://localhost:5001/api/config/tradingview" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tu_usuario_tv",
    "password": "tu_password",
    "testOnly": false
  }'

# Ver estado
curl "http://localhost:5001/api/config/tradingview/status"
```

---

## 🚨 Troubleshooting

### Problemas Comunes y Soluciones

#### Sistema No Responde

```bash
# Verificar procesos
pm2 list

# Reiniciar si está caído
pm2 restart tradingview-api

# Ver logs de error
pm2 logs tradingview-api --err

# Reinicio completo
pm2 kill
npm run start:cluster
```

#### Error de Rate Limiting

```bash
# Verificar configuración
grep RATE_LIMIT .env

# Aumentar límites temporalmente
sed -i 's/RATE_LIMIT_MAX_REQUESTS=100/RATE_LIMIT_MAX_REQUESTS=200/' .env
pm2 restart tradingview-api
```

#### Problemas de Conexión a TradingView

```bash
# Verificar credenciales
curl "http://localhost:5001/api/config/tradingview/status"

# Reconfigurar si es necesario
curl -X POST "http://localhost:5001/api/config/tradingview" \
  -H "Content-Type: application/json" \
  -d '{"testOnly": true}'
```

#### Alta Utilización de CPU/Memoria

```bash
# Verificar recursos
pm2 monit

# Reiniciar workers problemáticos
pm2 restart tradingview-api

# Verificar configuración adaptativa
grep MAX_CONCURRENT .env
```

### Logs Avanzados

```bash
# Buscar errores específicos
pm2 logs tradingview-api | grep "ERROR"

# Filtrar por operación
pm2 logs tradingview-api | grep "bulk_grant"

# Logs de las últimas 24h
pm2 logs tradingview-api --lines 1000 | grep "$(date -d '1 day ago' '+%Y-%m-%d')"

# Exportar logs para análisis
pm2 logs tradingview-api --out logs/debug-$(date +%Y%m%d).log
```

---

## 📈 Optimización de Performance

### Benchmarking del Sistema

```bash
# Test de carga básico
ab -n 1000 -c 10 http://localhost:5001/api/validate/testuser

# Test de operaciones bulk
node scripts/test-performance.js

# Monitoreo continuo
pm2 monit tradingview-api
```

### Configuración Adaptativa

| Configuración | ≤3 usuarios | 4-10 usuarios | 11+ usuarios |
|---------------|-------------|---------------|--------------|
| Concurrent | 5 | 5 | 3 |
| Delay (ms) | 100 | 200 | 300 |
| Batch Size | 5 | 5 | 3 |
| Rendimiento | ~6.6 ops/seg | ~4.2 ops/seg | ~3.8 ops/seg |

### Optimización de Recursos

```javascript
// Configuración recomendada para producción
{
  "node_env": "production",
  "clustering": true,
  "instances": 2,
  "max_memory_restart": "1G",
  "node_args": "--max-old-space-size=1024",
  "exec_mode": "cluster"
}
```

---

## 🔄 Actualizaciones y Mantenimiento

### Actualización del Sistema

```bash
# Backup antes de actualizar
./scripts/backup.sh

# Actualizar código
git pull origin main

# Instalar nuevas dependencias
npm install

# Ejecutar migraciones si existen
npm run migrate

# Reiniciar servicios
pm2 restart tradingview-api

# Verificar funcionamiento
curl http://localhost:5001/
```

### Limpieza del Sistema

```bash
# Limpiar logs antiguos
pm2 flush tradingview-api

# Limpiar npm cache
npm cache clean --force

# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install

# Limpiar archivos temporales
find . -name "*.log" -mtime +7 -delete
```

---

## 📋 Checklist de Administración

### ✅ Diaria
- [ ] Verificar estado de servicios (`pm2 list`)
- [ ] Revisar métricas críticas (`/api/metrics/stats`)
- [ ] Verificar logs de errores
- [ ] Monitorear uso de recursos

### ✅ Semanal
- [ ] Backup completo del sistema
- [ ] Revisar configuración de seguridad
- [ ] Verificar actualización de dependencias
- [ ] Test de carga básico

### ✅ Mensual
- [ ] Análisis de rendimiento histórico
- [ ] Optimización de configuración
- [ ] Actualización del sistema
- [ ] Revisión de documentación

### ✅ En Caso de Problemas
- [ ] Recopilar información de debug
- [ ] Verificar logs detallados
- [ ] Intentar reinicio de servicios
- [ ] Contactar soporte si persiste

---

## 📞 Contacto y Soporte

### Canales de Soporte

- **🚨 Emergencias**: [numero-emergencia]
- **📧 Email**: admin@tudominio.com
- **💬 Chat**: [slack/discord channel]
- **📖 Documentación**: docs.pinescript-access.com
- **🐛 Issues**: [github issues]

### Información para Reportar Problemas

```javascript
// Información crítica para soporte
const systemInfo = {
  timestamp: new Date().toISOString(),
  version: '2.3.1',
  nodeVersion: process.version,
  pm2Status: pm2.list(),
  systemLoad: require('os').loadavg(),
  memoryUsage: process.memoryUsage(),
  recentLogs: pm2.logs('tradingview-api', { lines: 50 }),
  configStatus: {
    tradingview: '/api/config/tradingview/status',
    metrics: '/api/metrics/health'
  }
};
```

---

**Versión**: 2.3.1  
**Última actualización**: Octubre 2025  
**Estado**: Documentación administrativa consolidada
