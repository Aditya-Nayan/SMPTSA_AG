# ─── Stage 1: Build the React app ───
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve with nginx ───
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config (uses envsubst for PORT)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway provides PORT env var
ENV PORT=8080
EXPOSE ${PORT}

# nginx with envsubst for dynamic port
CMD ["sh", "-c", "envsubst '${PORT} ${API_GATEWAY_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
