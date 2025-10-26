#!/bin/bash

# 🔐 Script para obtener Admin Token desde cualquier lugar
# Usa la X-API-Key para acceder remotamente

# Variables
API_URL="${API_URL:-http://185.218.124.241:5001}"
API_KEY="${ECOMMERCE_API_KEY:-your_ultra_secure_api_key_2025}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🔐 Obtener Admin Token (Acceso Remoto)                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar si jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq no está instalado (recomendado pero no requerido)${NC}"
    echo ""
fi

# Hacer request
echo -e "${BLUE}📡 Obteniendo token desde: ${API_URL}/admin/get-token${NC}"
echo ""

RESPONSE=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/admin/get-token")

# Verificar si curl funcionó
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: No se pudo conectar al servidor${NC}"
    echo -e "${YELLOW}   Verifica que el servidor esté corriendo en ${API_URL}${NC}"
    exit 1
fi

# Verificar si la respuesta es JSON válido
if ! echo "$RESPONSE" | jq . &> /dev/null; then
    echo -e "${RED}❌ Error: Respuesta inválida del servidor${NC}"
    echo -e "${YELLOW}   Respuesta recibida:${NC}"
    echo "$RESPONSE"
    exit 1
fi

# Verificar si hay error
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
    TOKEN=$(echo "$RESPONSE" | jq -r '.token')
    MESSAGE=$(echo "$RESPONSE" | jq -r '.message')
    
    echo -e "${GREEN}✅ ${MESSAGE}${NC}"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   🔑 ADMIN TOKEN:                                          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}${TOKEN}${NC}"
    echo ""
    echo -e "${BLUE}📋 Cómo usar:${NC}"
    echo -e "   1. Copia el token de arriba"
    echo -e "   2. Ve a: ${API_URL}/admin"
    echo -e "   3. Pega el token en el campo 'Token de Administrador'"
    echo -e "   4. Haz clic en 'Acceder al Panel'"
    echo ""
    echo -e "${YELLOW}⚠️  Nota: El token cambia cada vez que reinicias el servidor${NC}"
    echo ""
    
    # Copiar al portapapeles si está disponible
    if command -v pbcopy &> /dev/null; then
        echo "$TOKEN" | pbcopy
        echo -e "${GREEN}✅ Token copiado al portapapeles (macOS)${NC}"
    elif command -v xclip &> /dev/null; then
        echo "$TOKEN" | xclip -selection clipboard
        echo -e "${GREEN}✅ Token copiado al portapapeles (Linux)${NC}"
    elif command -v clip.exe &> /dev/null; then
        echo "$TOKEN" | clip.exe
        echo -e "${GREEN}✅ Token copiado al portapapeles (WSL)${NC}"
    fi
    
else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Error desconocido"')
    MESSAGE=$(echo "$RESPONSE" | jq -r '.message // "Sin detalles"')
    
    echo -e "${RED}❌ Error: ${ERROR}${NC}"
    echo -e "${YELLOW}   ${MESSAGE}${NC}"
    echo ""
    echo -e "${BLUE}💡 Posibles soluciones:${NC}"
    echo -e "   1. Verifica que la X-API-Key sea correcta"
    echo -e "   2. Verifica que el servidor esté corriendo"
    echo -e "   3. Intenta: curl -H 'X-API-Key: YOUR_KEY' ${API_URL}/admin/get-token"
    exit 1
fi

