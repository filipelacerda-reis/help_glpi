# Multi-stage build para otimização

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
# Tenta npm ci se package-lock.json existir, senão usa npm install
RUN if [ -f package-lock.json ]; then \
      npm ci || npm install; \
    else \
      npm install; \
    fi

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Argumento de build para VITE_API_URL
ARG VITE_API_URL=https://help.etus.io
ENV VITE_API_URL=$VITE_API_URL

# Copiar dependências
COPY --from=dependencies /app/node_modules ./node_modules

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Stage 3: Development
FROM node:20-alpine AS development
WORKDIR /app

# Copiar dependências e código
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Expor porta
EXPOSE 5173

# Comando para desenvolvimento
CMD ["npm", "run", "dev", "--", "--host"]

# Stage 4: Production (Nginx)
FROM nginx:alpine AS production

# Copiar arquivos buildados
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Comando para produção
CMD ["nginx", "-g", "daemon off;"]
