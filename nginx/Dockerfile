# --- Stage 1: Build frontend (React + Vite) ---
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:1.25-alpine
# Copy static files to nginx serving paths
COPY --from=frontend-builder /app/dist /usr/share/nginx/html/frontend
# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
