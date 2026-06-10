FROM ghcr.io/puppeteer/puppeteer:latest

USER root
RUN apt-get update && apt-get install -y chromium chromium-sandbox
USER pptruser

WORKDIR /app
COPY --chown=pptruser:pptruser package*.json ./
RUN npm install
COPY --chown=pptruser:pptruser . .

CMD ["node", "index.js"]
