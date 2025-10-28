/**
 * Configuración de Planes de Suscripción
 * Sistema de cuotas configurables desde variables de entorno
 */

const { logger } = require('../utils/logger');

/**
 * Configuración de planes desde variables de entorno
 * Alineado con planes de APIDevs: Free, Pro, Lifetime
 * 
 * Cuotas realistas para traders activos:
 * - Free: ~33 señales/día (2 gráficos, alertas cada 1h)
 * - Pro: ~500 señales/día (10 gráficos, alertas cada 15min)
 * - Lifetime: Ilimitado (beneficio VIP)
 */
const PLANS_CONFIG = {
  free: {
    name: 'Free',
    quota: parseInt(process.env.PLAN_FREE_QUOTA || '1000', 10), // ~33/día
    screenshots: true,
    resolution: '1080p',
    telegram: true,
    description: 'Plan gratuito - 2 gráficos con alertas cada hora'
  },
  pro: {
    name: 'Pro',
    quota: parseInt(process.env.PLAN_PRO_QUOTA || '15000', 10), // ~500/día
    screenshots: true,
    resolution: '1080p',
    telegram: true,
    description: 'Plan Pro (Mensual/Anual) - 10 gráficos cada 15min'
  },
  lifetime: {
    name: 'Lifetime',
    quota: parseInt(process.env.PLAN_LIFETIME_QUOTA || '-1', 10), // -1 = ilimitado
    screenshots: true,
    resolution: '4k',
    telegram: true,
    description: 'Acceso de por vida - Sin límites'
  }
};

/**
 * Cuota por defecto si no se encuentra el plan del usuario
 * Configurable con DEFAULT_QUOTA (default: 1000)
 */
const DEFAULT_QUOTA = parseInt(process.env.DEFAULT_QUOTA || '1000', 10);

/**
 * Cuota para usuarios sin plan asignado
 * Configurable con FALLBACK_QUOTA (default: 500)
 */
const FALLBACK_QUOTA = parseInt(process.env.FALLBACK_QUOTA || '500', 10);

/**
 * Modo de validación de cuota
 * - 'strict': Rechaza si excede cuota (default)
 * - 'soft': Permite exceder pero registra advertencia
 * - 'disabled': Desactiva validación de cuota
 */
const QUOTA_MODE = process.env.QUOTA_MODE || 'strict';

/**
 * Validar cuota del usuario
 * @param {number} signalsUsed - Señales usadas este mes
 * @param {number} signalsQuota - Cuota mensual del usuario
 * @param {string} userId - ID del usuario (para logs)
 * @returns {boolean} - true si puede continuar, false si excedió
 */
function validateQuota(signalsUsed, signalsQuota, userId = 'unknown') {
  // Modo deshabilitado: siempre permite
  if (QUOTA_MODE === 'disabled') {
    return true;
  }

  // Cuota ilimitada
  if (signalsQuota === -1) {
    return true;
  }

  // Verificar si excedió
  const exceeded = signalsUsed >= signalsQuota;

  if (exceeded) {
    logger.warn({
      userId,
      signalsUsed,
      signalsQuota,
      mode: QUOTA_MODE
    }, `⚠️ Cuota excedida (${signalsUsed}/${signalsQuota})`);

    // Modo soft: registra pero permite
    if (QUOTA_MODE === 'soft') {
      return true;
    }

    // Modo strict: rechaza
    return false;
  }

  return true;
}

/**
 * Obtener configuración del plan por nombre
 * @param {string} planName - Nombre del plan (free, pro, premium, etc)
 * @returns {Object} - Configuración del plan
 */
function getPlanConfig(planName) {
  const normalizedName = (planName || 'free').toLowerCase();
  return PLANS_CONFIG[normalizedName] || PLANS_CONFIG.free;
}

/**
 * Obtener cuota por nombre de plan
 * @param {string} planName - Nombre del plan
 * @returns {number} - Cuota del plan (-1 = ilimitado)
 */
function getQuotaByPlan(planName) {
  const plan = getPlanConfig(planName);
  return plan.quota;
}

/**
 * Verificar si un plan tiene cuota ilimitada
 * @param {number} quota - Cuota a verificar
 * @returns {boolean}
 */
function isUnlimitedQuota(quota) {
  return quota === -1;
}

/**
 * Calcular porcentaje de uso
 * @param {number} used - Señales usadas
 * @param {number} quota - Cuota total
 * @returns {number} - Porcentaje (0-100) o -1 si ilimitado
 */
function getUsagePercentage(used, quota) {
  if (isUnlimitedQuota(quota)) {
    return -1; // Ilimitado
  }

  if (quota === 0) {
    return 100;
  }

  return Math.round((used / quota) * 100);
}

/**
 * Obtener advertencia si está cerca del límite
 * @param {number} used - Señales usadas
 * @param {number} quota - Cuota total
 * @returns {string|null} - Mensaje de advertencia o null
 */
function getQuotaWarning(used, quota) {
  if (isUnlimitedQuota(quota)) {
    return null;
  }

  const percentage = getUsagePercentage(used, quota);

  if (percentage >= 100) {
    return 'Cuota mensual excedida. Actualiza tu plan para continuar.';
  }

  if (percentage >= 90) {
    return `Has usado el ${percentage}% de tu cuota mensual. Considera actualizar tu plan.`;
  }

  if (percentage >= 75) {
    return `Has usado el ${percentage}% de tu cuota mensual.`;
  }

  return null;
}

/**
 * Log de configuración de planes al iniciar servidor
 */
function logPlansConfiguration() {
  logger.info('📊 Configuración de Planes:');
  
  Object.entries(PLANS_CONFIG).forEach(([key, plan]) => {
    const quotaText = plan.quota === -1 ? 'Ilimitado' : `${plan.quota} señales/mes`;
    logger.info(`   ${plan.name}: ${quotaText} (${plan.resolution})`);
  });

  logger.info(`   Default Quota: ${DEFAULT_QUOTA}`);
  logger.info(`   Fallback Quota: ${FALLBACK_QUOTA}`);
  logger.info(`   Quota Mode: ${QUOTA_MODE}`);
}

module.exports = {
  PLANS_CONFIG,
  DEFAULT_QUOTA,
  FALLBACK_QUOTA,
  QUOTA_MODE,
  validateQuota,
  getPlanConfig,
  getQuotaByPlan,
  isUnlimitedQuota,
  getUsagePercentage,
  getQuotaWarning,
  logPlansConfiguration
};

