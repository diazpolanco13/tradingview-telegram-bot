/**
 * Rate Limiter Middleware - Multi-nivel
 * Protege el sistema contra abuso/configuraciones agresivas
 * 
 * Niveles de protección:
 * 1. Por minuto (anti-burst): 10 alertas/min
 * 2. Por hora (anti-spam): 100 alertas/hora
 * 3. Por día (cuota): Según plan del usuario
 */

const { logger } = require('../utils/logger');
const { getRedisConnection } = require('../config/redis-optional');

/**
 * Verificar rate limit de un usuario
 * @param {string} userId - ID del usuario
 * @param {string} userPlan - Plan del usuario (free/pro/lifetime)
 * @returns {Promise<Object>} - { allowed, reason, limits }
 */
async function checkRateLimit(userId, userPlan = 'free') {
  const redis = getRedisConnection();
  
  // Si no hay Redis, permitir (modo desarrollo)
  if (!redis) {
    return { 
      allowed: true, 
      reason: 'Redis no disponible (modo desarrollo)',
      limits: {}
    };
  }

  const now = Date.now();
  const currentMinute = Math.floor(now / 60000); // Minuto actual
  const currentHour = Math.floor(now / 3600000); // Hora actual
  const currentDay = new Date().toISOString().split('T')[0]; // Día actual (YYYY-MM-DD)

  // Keys de Redis
  const minuteKey = `ratelimit:${userId}:minute:${currentMinute}`;
  const hourKey = `ratelimit:${userId}:hour:${currentHour}`;
  const dayKey = `ratelimit:${userId}:day:${currentDay}`;

  try {
    // 1. LÍMITE POR MINUTO (Anti-burst)
    const LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 10;
    const countMinute = await redis.incr(minuteKey);
    
    if (countMinute === 1) {
      await redis.expire(minuteKey, 60); // Expira en 60 segundos
    }

    if (countMinute > LIMIT_PER_MINUTE) {
      logger.warn({ userId, count: countMinute }, '⚠️ Rate limit por minuto excedido');
      return {
        allowed: false,
        reason: 'rate_limit_minute',
        message: `Máximo ${LIMIT_PER_MINUTE} alertas por minuto. Espera un momento.`,
        limits: {
          perMinute: { current: countMinute, max: LIMIT_PER_MINUTE },
          waitSeconds: 60 - (Math.floor(now / 1000) % 60)
        }
      };
    }

    // 2. LÍMITE POR HORA (Anti-spam)
    const LIMIT_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR) || 100;
    const countHour = await redis.incr(hourKey);
    
    if (countHour === 1) {
      await redis.expire(hourKey, 3600); // Expira en 1 hora
    }

    if (countHour > LIMIT_PER_HOUR) {
      logger.warn({ userId, count: countHour }, '⚠️ Rate limit por hora excedido');
      return {
        allowed: false,
        reason: 'rate_limit_hour',
        message: `Máximo ${LIMIT_PER_HOUR} alertas por hora. Espera un poco.`,
        limits: {
          perHour: { current: countHour, max: LIMIT_PER_HOUR },
          waitMinutes: 60 - (Math.floor((now / 60000)) % 60)
        }
      };
    }

    // 3. LÍMITE DIARIO (Según plan)
    const dailyLimits = {
      free: parseInt(process.env.DAILY_LIMIT_FREE) || 50,      // ~1500/mes
      pro: parseInt(process.env.DAILY_LIMIT_PRO) || 600,       // ~18000/mes
      lifetime: -1 // Ilimitado
    };

    const dailyLimit = dailyLimits[userPlan] || dailyLimits.free;

    // Si es lifetime (ilimitado), no verificar límite diario
    if (dailyLimit !== -1) {
      const countDay = await redis.incr(dayKey);
      
      if (countDay === 1) {
        // Expira a medianoche
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now) / 1000);
        await redis.expire(dayKey, secondsUntilMidnight);
      }

      if (countDay > dailyLimit) {
        logger.warn({ userId, count: countDay, plan: userPlan }, '⚠️ Rate limit diario excedido');
        return {
          allowed: false,
          reason: 'rate_limit_daily',
          message: `Has alcanzado tu límite diario de ${dailyLimit} alertas. Actualiza tu plan o espera hasta mañana.`,
          limits: {
            perDay: { current: countDay, max: dailyLimit },
            plan: userPlan
          }
        };
      }
    }

    // ✅ PERMITIDO
    return {
      allowed: true,
      reason: 'ok',
      limits: {
        perMinute: { current: countMinute, max: LIMIT_PER_MINUTE },
        perHour: { current: countHour, max: LIMIT_PER_HOUR },
        perDay: dailyLimit === -1 
          ? { current: 'unlimited', max: 'unlimited' }
          : { current: await redis.get(dayKey) || 0, max: dailyLimit }
      }
    };

  } catch (error) {
    logger.error({ error: error.message }, '❌ Error en rate limiter');
    // En caso de error, permitir (fail-open)
    return { 
      allowed: true, 
      reason: 'error_checking_rate_limit',
      error: error.message 
    };
  }
}

/**
 * Obtener estadísticas de rate limit de un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} - Uso actual en todos los niveles
 */
async function getRateLimitStats(userId) {
  const redis = getRedisConnection();
  
  if (!redis) {
    return { error: 'Redis no disponible' };
  }

  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const currentHour = Math.floor(now / 3600000);
  const currentDay = new Date().toISOString().split('T')[0];

  const minuteKey = `ratelimit:${userId}:minute:${currentMinute}`;
  const hourKey = `ratelimit:${userId}:hour:${currentHour}`;
  const dayKey = `ratelimit:${userId}:day:${currentDay}`;

  try {
    const [countMinute, countHour, countDay] = await Promise.all([
      redis.get(minuteKey),
      redis.get(hourKey),
      redis.get(dayKey)
    ]);

    return {
      perMinute: parseInt(countMinute) || 0,
      perHour: parseInt(countHour) || 0,
      perDay: parseInt(countDay) || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error obteniendo rate limit stats');
    return { error: error.message };
  }
}

/**
 * Resetear rate limit de un usuario (solo para testing/admin)
 * @param {string} userId - ID del usuario
 */
async function resetRateLimit(userId) {
  const redis = getRedisConnection();
  
  if (!redis) {
    throw new Error('Redis no disponible');
  }

  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const currentHour = Math.floor(now / 3600000);
  const currentDay = new Date().toISOString().split('T')[0];

  const keys = [
    `ratelimit:${userId}:minute:${currentMinute}`,
    `ratelimit:${userId}:hour:${currentHour}`,
    `ratelimit:${userId}:day:${currentDay}`
  ];

  await Promise.all(keys.map(key => redis.del(key)));
  logger.info({ userId }, '🔄 Rate limit reseteado');
}

module.exports = {
  checkRateLimit,
  getRateLimitStats,
  resetRateLimit
};

