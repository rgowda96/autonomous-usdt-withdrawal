FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Install tsx so we can run TS directly without a separate build step (v0).
RUN npm install tsx@^4.19.1

CMD ["node", "--import", "tsx/esm", "src/server.ts"]
