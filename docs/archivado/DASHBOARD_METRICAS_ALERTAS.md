# 📊 Dashboard de Métricas de Alertas - Manual para IA de Next.js

> **Guía completa para implementar el dashboard de administración y métricas del microservicio de alertas**

---

## 🎯 Objetivo

Crear un dashboard administrativo donde puedas monitorear en tiempo real:
- ✅ Estado del Browser Pool (navegadores disponibles/en uso)
- ✅ Cola de procesamiento (jobs esperando/activos/completados)
- ✅ Performance del sistema (tasa de éxito, tiempo promedio)
- ✅ Capacidad y escalabilidad (usuarios actuales vs máximos)
- ✅ Métricas de sistema (memoria, uptime, Node version)

---

## 📡 Endpoints del Microservicio

**Base URL:** `https://alerts.apidevs-api.com`

### **1. GET `/admin/metrics`**

Dashboard completo con todas las métricas del sistema.

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2025-10-29T16:00:00Z",
  "uptime": "2d 5h 30m",
  "uptimeSeconds": 192600,
  
  "browserPool": {
    "total": 8,
    "available": 5,
    "inUse": 3,
    "status": "healthy",
    "totalCreated": 12,
    "totalClosed": 4,
    "totalCaptures": 1543,
    "activeCaptures": 3
  },
  
  "queue": {
    "waiting": 12,
    "active": 10,
    "completed": 1543,
    "failed": 7,
    "delayed": 0,
    "paused": 0,
    "total": 1572
  },
  
  "performance": {
    "screenshotsCompleted": 1543,
    "screenshotsFailed": 7,
    "successRate": "99.55%",
    "estimatedPerHour": 132,
    "screenshotsToday": 234,
    "avgScreenshotTime": "6.2s"
  },
  
  "capacity": {
    "currentLoad": "37.5%",
    "maxConcurrency": 10,
    "maxBrowsers": 12,
    "estimatedUsers": 120,
    "maxCapacity": 345,
    "utilizationPercent": "34.8"
  },
  
  "database": {
    "totalSignals": 15234,
    "totalUsers": 45,
    "signalsToday": 234
  },
  
  "system": {
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "memory": {
      "used": "245.67 MB",
      "total": "512.00 MB"
    }
  }
}
```

---

### **2. GET `/admin/pool-status`**

Estado detallado del Browser Pool.

**Respuesta:**
```json
{
  "success": true,
  "initialized": true,
  "config": {
    "minBrowsers": 5,
    "maxBrowsers": 12,
    "idleTimeout": "30min",
    "cleanupInterval": "10min",
    "warmup": true
  },
  "stats": {
    "total": 8,
    "available": 5,
    "inUse": 3,
    "totalCreated": 12,
    "totalClosed": 4,
    "totalCaptures": 1543,
    "activeCaptures": 3
  },
  "browsers": [
    {
      "id": "browser-1",
      "status": "in_use",
      "lastUsed": "2s ago",
      "createdAt": "2025-10-29T14:30:00Z",
      "uptime": "90m"
    },
    {
      "id": "browser-2",
      "status": "available",
      "lastUsed": "45s ago",
      "createdAt": "2025-10-29T14:30:00Z",
      "uptime": "90m"
    }
  ]
}
```

---

### **3. GET `/admin/queue-stats`**

Estadísticas detalladas de la cola BullMQ.

**Respuesta:**
```json
{
  "success": true,
  "counts": {
    "waiting": 12,
    "active": 10,
    "completed": 1543,
    "failed": 7,
    "delayed": 0,
    "paused": 0
  },
  "recentCompleted": [
    {
      "id": "screenshot-job-123",
      "status": "completed",
      "processedOn": "2025-10-29T16:00:00Z",
      "finishedOn": "2025-10-29T16:00:06Z",
      "duration": "6.2s",
      "data": {
        "ticker": "BINANCE:BTCUSDT",
        "userId": "71b7b58f..."
      }
    }
  ],
  "activeJobs": [
    {
      "id": "screenshot-job-456",
      "status": "active",
      "processedOn": "2025-10-29T16:00:10Z",
      "data": {
        "ticker": "OKX:ETHUSDT.P",
        "userId": "a1b2c3d4..."
      }
    }
  ]
}
```

---

## 🎨 Componentes a Implementar

### **Archivo:** `app/admin/metrics/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Server, 
  TrendingUp, 
  Users, 
  Database,
  Clock,
  Cpu,
  HardDrive
} from 'lucide-react';

interface Metrics {
  success: boolean;
  timestamp: string;
  uptime: string;
  uptimeSeconds: number;
  browserPool: {
    total: number;
    available: number;
    inUse: number;
    status: 'healthy' | 'busy' | 'saturated';
    totalCreated: number;
    totalClosed: number;
    totalCaptures: number;
    activeCaptures: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    total: number;
  };
  performance: {
    screenshotsCompleted: number;
    screenshotsFailed: number;
    successRate: string;
    estimatedPerHour: number;
    screenshotsToday: number;
    avgScreenshotTime: string;
  };
  capacity: {
    currentLoad: string;
    maxConcurrency: number;
    maxBrowsers: number;
    estimatedUsers: number;
    maxCapacity: number;
    utilizationPercent: string;
  };
  database: {
    totalSignals: number;
    totalUsers: number;
    signalsToday: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    memory: {
      used: string;
      total: string;
    };
  };
}

interface PoolStatus {
  success: boolean;
  initialized: boolean;
  config?: {
    minBrowsers: number;
    maxBrowsers: number;
    idleTimeout: string;
    cleanupInterval: string;
    warmup: boolean;
  };
  stats?: {
    total: number;
    available: number;
    inUse: number;
    totalCreated: number;
    totalClosed: number;
    totalCaptures: number;
    activeCaptures: number;
  };
  browsers?: Array<{
    id: string;
    status: 'in_use' | 'available';
    lastUsed: string;
    createdAt: string;
    uptime: string;
  }>;
  message?: string;
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, poolRes] = await Promise.all([
          fetch('https://alerts.apidevs-api.com/admin/metrics'),
          fetch('https://alerts.apidevs-api.com/admin/pool-status')
        ]);
        
        const metricsData = await metricsRes.json();
        const poolData = await poolRes.json();
        
        setMetrics(metricsData);
        setPoolStatus(poolData);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Actualizar cada 5 segundos
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando métricas del sistema...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg font-semibold">Error cargando métricas</p>
          <p className="text-muted-foreground">Por favor, recarga la página</p>
        </div>
      </div>
    );
  }

  const poolUtilization = (metrics.browserPool.inUse / metrics.browserPool.total) * 100;
  const capacityUtilization = parseFloat(metrics.capacity.utilizationPercent);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Métricas del Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Microservicio de Alertas TradingView - Monitoreo en tiempo real
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2">
            <Clock className="w-3 h-3 mr-1" />
            Uptime: {metrics.uptime}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Métricas Principales - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Browser Pool Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Server className="w-4 h-4 mr-2 text-blue-500" />
              Browser Pool
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {metrics.browserPool.inUse}/{metrics.browserPool.total}
              </div>
              <Progress value={poolUtilization} className="h-2" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {metrics.browserPool.available} disponibles
                </span>
                <Badge 
                  variant={
                    metrics.browserPool.status === 'healthy' ? 'default' : 
                    metrics.browserPool.status === 'busy' ? 'secondary' : 
                    'destructive'
                  }
                  className="text-xs"
                >
                  {metrics.browserPool.status === 'healthy' ? '✓ Saludable' :
                   metrics.browserPool.status === 'busy' ? '⚠ Ocupado' :
                   '⚠ Saturado'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Total capturas: {metrics.browserPool.totalCaptures.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Stats Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="w-4 h-4 mr-2 text-green-500" />
              Cola de Procesamiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Esperando:</span>
                <span className="font-semibold text-orange-600">{metrics.queue.waiting}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Activos:</span>
                <span className="font-semibold text-blue-600">{metrics.queue.active}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completados:</span>
                <span className="font-semibold text-green-600">
                  {metrics.queue.completed.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">Fallidos:</span>
                <span className="font-semibold text-red-600">{metrics.queue.failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600">
                {metrics.performance.successRate}
              </div>
              <p className="text-xs text-muted-foreground">Tasa de éxito</p>
              
              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Screenshots hoy:</span>
                  <span className="font-semibold">{metrics.performance.screenshotsToday}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Estimado/hora:</span>
                  <span className="font-semibold">{metrics.performance.estimatedPerHour}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tiempo promedio:</span>
                  <span className="font-semibold">{metrics.performance.avgScreenshotTime}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2 text-indigo-500" />
              Capacidad del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {metrics.capacity.utilizationPercent}%
              </div>
              <Progress 
                value={capacityUtilization} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {metrics.capacity.estimatedUsers} de {metrics.capacity.maxCapacity} usuarios
              </p>
              
              <div className="space-y-1 pt-2 border-t text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carga actual:</span>
                  <span className="font-semibold">{metrics.capacity.currentLoad}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max concurrencia:</span>
                  <span className="font-semibold">{metrics.capacity.maxConcurrency}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda Fila - Database y System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Database Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2 text-cyan-500" />
              Estadísticas de Base de Datos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Total de Señales</span>
                <span className="text-2xl font-bold">
                  {metrics.database.totalSignals.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Usuarios Registrados</span>
                <span className="text-2xl font-bold">{metrics.database.totalUsers}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Señales Hoy</span>
                <span className="text-2xl font-bold text-green-600">
                  {metrics.database.signalsToday}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Cpu className="w-5 h-5 mr-2 text-orange-500" />
              Información del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Node.js</span>
                <Badge variant="outline">{metrics.system.nodeVersion}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Plataforma</span>
                <Badge variant="outline">{metrics.system.platform}</Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium flex items-center">
                    <HardDrive className="w-4 h-4 mr-1" />
                    Memoria
                  </span>
                  <span className="text-sm font-semibold">
                    {metrics.system.memory.used} / {metrics.system.memory.total}
                  </span>
                </div>
                <Progress 
                  value={
                    (parseFloat(metrics.system.memory.used) / 
                     parseFloat(metrics.system.memory.total)) * 100
                  } 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Browser Pool Detail */}
      {poolStatus?.initialized && poolStatus.browsers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Server className="w-5 h-5 mr-2" />
                Estado Detallado del Browser Pool
              </span>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">
                  Min: {poolStatus.config?.minBrowsers}
                </Badge>
                <Badge variant="outline">
                  Max: {poolStatus.config?.maxBrowsers}
                </Badge>
                <Badge variant="outline">
                  Timeout: {poolStatus.config?.idleTimeout}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {poolStatus.browsers.map((browser) => (
                <div 
                  key={browser.id} 
                  className={`border rounded-lg p-4 ${
                    browser.status === 'in_use' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="font-semibold text-sm mb-2">{browser.id}</div>
                  <Badge 
                    variant={browser.status === 'in_use' ? 'default' : 'secondary'}
                    className="text-xs mb-2"
                  >
                    {browser.status === 'in_use' ? '🔵 En Uso' : '⚪ Disponible'}
                  </Badge>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Usado: {browser.lastUsed}</div>
                    <div>Uptime: {browser.uptime}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer con info adicional */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <p>Microservicio de Alertas TradingView v2.0</p>
              <p className="text-xs mt-1">
                Actualización automática cada 5 segundos
              </p>
            </div>
            <div className="text-right">
              <p>Timestamp: {new Date(metrics.timestamp).toLocaleString()}</p>
              <p className="text-xs mt-1">
                {metrics.success ? '✅ Sistema operativo' : '❌ Error en sistema'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🗂️ Estructura de Archivos

```
app/
├── admin/
│   └── metrics/
│       └── page.tsx          ← Componente principal (código arriba)
│
components/
└── ui/
    ├── card.tsx              ← Shadcn/ui Card
    ├── badge.tsx             ← Shadcn/ui Badge
    └── progress.tsx          ← Shadcn/ui Progress
```

---

## 🎨 Estilos y Tema

El componente usa:
- **Tailwind CSS** para estilos
- **Shadcn/ui** para componentes base (Card, Badge, Progress)
- **Lucide Icons** para iconos
- **Tema oscuro** automático con `dark:` variants

---

## 🚀 Instalación de Dependencias

```bash
# Shadcn/ui components
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add progress

# Lucide icons
npm install lucide-react
```

---

## 📱 Características del Dashboard

### **✅ Auto-refresh cada 5 segundos**
```typescript
const interval = setInterval(fetchData, 5000);
```

### **✅ Estados visuales del Browser Pool**
- 🟢 **Healthy:** < 50% en uso
- 🟡 **Busy:** 50-80% en uso
- 🔴 **Saturated:** > 80% en uso

### **✅ Indicadores de capacidad**
- Barra de progreso de utilización
- Usuarios estimados vs máxima capacidad
- Porcentaje de uso del sistema

### **✅ Métricas en tiempo real**
- Screenshots completados/fallidos
- Tasa de éxito
- Tiempo promedio de procesamiento

### **✅ Vista detallada de navegadores**
- Estado individual de cada navegador
- Última vez usado
- Uptime por navegador

---

## 🎯 Routing en Next.js

Agregar en tu navegación:

```typescript
// app/layout.tsx o navbar
{
  label: 'Admin Métricas',
  href: '/admin/metrics',
  icon: Activity,
  adminOnly: true  // Restringir a admins
}
```

---

## 🔐 Seguridad

**⚠️ IMPORTANTE:** Este dashboard debe estar protegido solo para administradores.

```typescript
// app/admin/metrics/page.tsx - Al inicio del componente

export default function AdminMetricsPage() {
  const { user } = useUser(); // Hook de tu sistema de auth
  
  // Verificar que el usuario sea admin
  if (!user || user.role !== 'admin') {
    redirect('/unauthorized');
  }
  
  // Resto del código...
}
```

---

## 📊 Interpretación de Métricas

### **Browser Pool Status:**
- **healthy:** Sistema funcionando bien, hay navegadores disponibles
- **busy:** Sistema bajo carga moderada, considera escalar pronto
- **saturated:** Sistema al límite, escalar URGENTE

### **Queue Stats:**
- **waiting > 20:** Cola creciendo, considera aumentar concurrency
- **active = maxConcurrency:** Sistema procesando a máxima capacidad
- **failed > 5%:** Investigar causas de fallos

### **Capacity:**
- **utilizationPercent < 50%:** Sistema OK
- **utilizationPercent 50-80%:** Preparar escalado
- **utilizationPercent > 80%:** Necesitas escalar YA

---

## 🔧 Personalización

### **Cambiar intervalo de actualización:**
```typescript
const interval = setInterval(fetchData, 10000); // 10 segundos
```

### **Agregar alertas visuales:**
```typescript
{capacityUtilization > 80 && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Sistema cerca del límite</AlertTitle>
    <AlertDescription>
      Considera escalar a múltiples instancias
    </AlertDescription>
  </Alert>
)}
```

### **Exportar métricas:**
```typescript
const exportMetrics = () => {
  const dataStr = JSON.stringify(metrics, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `metrics-${new Date().toISOString()}.json`;
  link.click();
};
```

---

## ✅ Checklist de Implementación

- [ ] Crear archivo `app/admin/metrics/page.tsx`
- [ ] Instalar dependencias (shadcn/ui, lucide-react)
- [ ] Copiar el código del componente
- [ ] Ajustar colores a tu tema
- [ ] Agregar protección de admin
- [ ] Agregar al menú de navegación
- [ ] Probar en desarrollo (`npm run dev`)
- [ ] Verificar que se actualice cada 5s
- [ ] Deploy a producción

---

## 🎁 Bonus: Widget Compacto para Sidebar

Si quieres un widget pequeño en el sidebar:

```typescript
export function MetricsWidget() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const fetch = async () => {
      const res = await fetch('https://alerts.apidevs-api.com/admin/metrics');
      setMetrics(await res.json());
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);
  
  if (!metrics) return null;
  
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground mb-2">Sistema</div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Pool:</span>
          <Badge variant={metrics.browserPool.status === 'healthy' ? 'default' : 'destructive'}>
            {metrics.browserPool.inUse}/{metrics.browserPool.total}
          </Badge>
        </div>
        <div className="flex justify-between text-sm">
          <span>Cola:</span>
          <span className="font-semibold">{metrics.queue.active}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Éxito:</span>
          <span className="font-semibold text-green-600">
            {metrics.performance.successRate}
          </span>
        </div>
      </div>
    </Card>
  );
}
```

---

**Versión:** 1.0  
**Última actualización:** 29 Octubre 2025  
**Estado:** ✅ Listo para implementar

---

## 📞 Soporte

Si algo no funciona:
1. Verifica que el microservicio esté corriendo
2. Verifica que los endpoints respondan (curl/Postman)
3. Revisa la consola del navegador para errores
4. Verifica permisos de admin

**¡Listo para crear un dashboard profesional!** 🚀

