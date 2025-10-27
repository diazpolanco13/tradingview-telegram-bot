/**
 * Admin Authentication System
 * Sistema de tokens similar al del código Python funcional
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Token admin generado al iniciar la aplicación (similar al Python)
let currentAdminToken = null;

/**
 * Generate a secure admin token
 * Similar al sistema Python que genera tokens criptográficos
 */
function generateAdminToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Initialize admin authentication
 * Se llama al iniciar la aplicación
 */
function initAdminAuth() {
  currentAdminToken = generateAdminToken();

  // Guardar token en archivo para acceso fácil con PM2
  const tokenFilePath = path.join(__dirname, '../../admin-token.txt');
  try {
    fs.writeFileSync(tokenFilePath, currentAdminToken, 'utf8');
    console.log('🔐 Admin token generado para esta sesión:');
    console.log(`   ${currentAdminToken}`);
    console.log(`   📄 Token guardado en: ${tokenFilePath}`);
    console.log('   Usa este token para acceder al panel de administración');
    console.log('   💡 También puedes obtenerlo desde: http://localhost:${process.env.PORT || 5002}/admin-token');
  } catch (error) {
    console.error('⚠️ Error al guardar token en archivo:', error.message);
    console.log('🔐 Admin token generado para esta sesión:');
    console.log(`   ${currentAdminToken}`);
    console.log('   Usa este token para acceder al panel de administración');
  }

  return currentAdminToken;
}

/**
 * Validate admin token
 * @param {string} token - Token a validar
 * @returns {boolean} true si es válido
 */
function validateAdminToken(token) {
  return token === currentAdminToken;
}

/**
 * Get current admin token (for internal use)
 */
function getCurrentAdminToken() {
  return currentAdminToken;
}

/**
 * Middleware para validar tokens de admin
 * Similar al sistema Python pero usando headers
 */
function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'];

  if (!token) {
    return res.status(401).json({
      error: 'Token de administrador requerido',
      message: 'Incluye X-Admin-Token en los headers'
    });
  }

  if (!validateAdminToken(token)) {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'Token de administrador incorrecto'
    });
  }

  next();
}

module.exports = {
  initAdminAuth,
  validateAdminToken,
  getCurrentAdminToken,
  requireAdminToken
};
