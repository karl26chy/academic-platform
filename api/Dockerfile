FROM node:20-alpine

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
