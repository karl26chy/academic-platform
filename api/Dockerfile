FROM node:20-alpine

# Chromium para puppeteer-core (generación de boletines PDF), igual que Dockerfile.dev
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY schema.sql ./
COPY src ./src
COPY scripts ./scripts
COPY assets ./assets

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
