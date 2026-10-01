# ── Etapa 1: Compilación de React ─────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias e instalar con reintentos para redes inestables
COPY package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    (npm ci --no-audit || npm install --no-audit)

# Copiar todo el código fuente y compilar para producción
COPY . .
RUN npm run build

# ── Etapa 2: Servidor Nginx de Producción ─────────────────────
FROM nginx:alpine

# Eliminar scripts automáticos innecesarios que bloquean el inicio
RUN rm -rf /docker-entrypoint.d/*

# Copiar archivos compilados a la carpeta web de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
