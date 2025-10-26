#!/usr/bin/env node

/**
 * Script para obtener el token de administrador
 * Útil cuando el servidor está corriendo con PM2 y no se ve la consola
 */

const fs = require('fs');
const path = require('path');

function getAdminTokenFromFile() {
  const tokenFilePath = path.join(__dirname, '../admin-token.txt');

  try {
    if (fs.existsSync(tokenFilePath)) {
      const token = fs.readFileSync(tokenFilePath, 'utf8').trim();
      console.log('🔐 Token de Administrador:');
      console.log(`   ${token}`);
      console.log('');
      console.log('📋 Para copiar:');
      console.log(`   echo "${token}" | xclip -selection clipboard  # Linux`);
      console.log(`   echo "${token}" | pbcopy  # macOS`);
      console.log('');
      console.log('🌐 URL del panel de administración:');
      console.log('   http://185.218.124.241:5001/admin');
      return token;
    } else {
      console.log('❌ Archivo de token no encontrado');
      console.log('   El servidor podría no estar ejecutándose o no se ha iniciado aún');
      console.log('');
      console.log('💡 Soluciones:');
      console.log('   1. Asegúrate de que el servidor esté corriendo');
      console.log('   2. Si usas PM2, verifica con: pm2 logs');
      console.log('   3. O usa el endpoint: curl http://localhost:5001/admin-token');
      return null;
    }
  } catch (error) {
    console.error('❌ Error al leer el archivo de token:', error.message);
    return null;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  console.log('🔍 Obteniendo token de administrador...\n');
  getAdminTokenFromFile();
}

module.exports = { getAdminTokenFromFile };
