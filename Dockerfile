FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 25565/tcp 3000/tcp
CMD ["node", "src/main.js"]
