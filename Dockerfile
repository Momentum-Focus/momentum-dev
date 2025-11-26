# ============================================
# STAGE 1: Dependencies - Instala dependências
# ============================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Instalar dependências do sistema necessárias
RUN apk add --no-cache \
    openssl \
    libc6-compat

# Copiar apenas arquivos de dependências (melhor cache)
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas as dependências (incluindo devDependencies para desenvolvimento)
RUN npm ci

# ============================================
# STAGE 2: Builder - Compila a aplicação
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema (wget para healthcheck)
RUN apk add --no-cache openssl wget

# Copiar node_modules do estágio anterior
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Gerar cliente Prisma
RUN npx prisma generate

# Compilar aplicação NestJS
RUN npm run build

# ============================================
# STAGE 3: Development - Para desenvolvimento
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Instalar dependências do sistema (wget para healthcheck)
RUN apk add --no-cache openssl wget

# Copiar node_modules e código do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/nest-cli.json ./

# Gerar Prisma Client novamente (para garantir)
RUN npx prisma generate

EXPOSE 3000 9229

CMD ["npm", "run", "start:dev"]

# ============================================
# STAGE 4: Production - Imagem final otimizada
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Instalar dependências do sistema (openssl para Prisma, curl para healthcheck)
RUN apk add --no-cache \
    openssl \
    curl \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copiar apenas arquivos necessários para produção
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/tsconfig*.json ./

# Gerar Prisma Client para produção
RUN npx prisma generate

# Mudar para usuário não-root
USER nestjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Comando de entrada: migrações + seed + start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main.js"]
