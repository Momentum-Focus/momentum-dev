# Dockerfile simples para NestJS com Prisma
FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache openssl

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar cliente Prisma e fazer build
RUN npx prisma generate
RUN npm run build

# Expor porta
EXPOSE 3000

# Comando que roda migrações, seed e inicia a aplicação
CMD npx prisma migrate deploy && npm run seed && npm run start:prod
