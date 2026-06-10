# --- Stage 1: Build admin-web (React) ---
FROM node:22-alpine AS admin-builder
WORKDIR /app
COPY admin-web/package*.json ./
RUN npm install --legacy-peer-deps
COPY admin-web/ .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# --- Stage 2: Build mobile-web (Vite) ---
FROM node:22-alpine AS mobile-builder
WORKDIR /app
COPY mobile-web/package*.json ./
RUN npm install --legacy-peer-deps
COPY mobile-web/ .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- Stage 3: Serve with Nginx ---
FROM nginx:1.25-alpine
# Copy static files to nginx serving paths
COPY --from=admin-builder /app/build /usr/share/nginx/html/admin
COPY --from=mobile-builder /app/dist /usr/share/nginx/html/mobile
# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
