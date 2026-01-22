# Multi-stage build para otimização

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl openssl-dev

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
# Tenta npm ci se package-lock.json existir, senão usa npm install
RUN if [ -f package-lock.json ]; then \
      npm ci || npm install; \
    else \
      npm install; \
    fi

# Gerar Prisma Client
RUN npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copiar dependências do stage anterior
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma

# Copiar código fonte
COPY . .

# Garantir que scripts existem e criar arquivo vazio se necessário
RUN mkdir -p scripts && \
    touch scripts/.keep || true

# Build do TypeScript
RUN npm run build

# Stage 3: Development
FROM node:20-alpine AS development
WORKDIR /app

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl openssl-dev

# Copiar dependências e código
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma
COPY . .

# Expor porta
EXPOSE 8080

# Comando para desenvolvimento
CMD ["npm", "run", "dev"]

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl openssl-dev

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar dependências de produção
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma

# Copiar código compilado
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Copiar código fonte (necessário para o seed funcionar com tsx)
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Copiar scripts de suporte (opcionais, usados para ferramentas/migrations)
RUN mkdir -p scripts uploads/tickets uploads/journal

# Copiar scripts do stage de build
# Como garantimos que scripts existe no stage de build (com .keep), o COPY sempre funciona
COPY --from=build /app/scripts ./scripts

# Remover arquivo .keep se existir
RUN rm -f ./scripts/.keep 2>/dev/null || true

# Garantir permissões dos scripts (se existirem)
RUN if [ -d ./scripts ] && [ -n "$(find ./scripts -name '*.sh' -type f 2>/dev/null | head -1)" ]; then \
      chmod +x ./scripts/*.sh 2>/dev/null || true; \
    fi && \
    chown -R nodejs:nodejs /app

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para produção
CMD ["npm", "run", "start"]

