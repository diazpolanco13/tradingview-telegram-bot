# Dockerfile optimizado para TradingView Telegram Bot
FROM node:18-alpine

# Instalar Chromium y dependencias para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Variables de entorno para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --production && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY public/ ./public/

# Crear directorios necesarios
RUN mkdir -p logs data screenshots

# Configurar permisos
RUN chmod +x scripts/*.js || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5002/health || exit 1

# Exponer puerto
EXPOSE 5002

# Comando de inicio
CMD ["npm", "start"]
