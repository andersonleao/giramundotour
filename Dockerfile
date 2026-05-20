FROM node:20-slim

# Instala Chromium e dependências para Puppeteer (geração de PDF)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer usa o Chromium do sistema (não baixa o próprio)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Instala dependências do backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copia código-fonte
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3000

CMD ["node", "--max-old-space-size=256", "backend/src/server.js"]
