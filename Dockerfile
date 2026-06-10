FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Esto es lo que faltaba: le damos permiso al usuario 'pptruser'
COPY --chown=pptruser:pptruser package*.json ./
RUN npm install

COPY --chown=pptruser:pptruser . .

USER pptruser

CMD ["node", "index.js"]
