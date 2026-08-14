# Imagen del API. Convención de este stack: dist/ y node_modules se preparan
# en el host (npm install && npm run build en deploy.sh) y se copian tal cual;
# solo prisma generate corre dentro del build.
FROM node:24-slim

RUN apt-get update -qq && apt-get install -y -qq openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

COPY .env ./
COPY dist ./dist

EXPOSE 3005

CMD ["node", "dist/index.js"]
