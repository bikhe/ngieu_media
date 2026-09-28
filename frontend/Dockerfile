FROM node:22-alpine

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies from the committed lockfile so font packages are
# present when Vite resolves the CSS imports.
RUN npm ci

# Copy all application files
COPY . .

# Expose port
EXPOSE 5173

# Start Vite dev server bound to all interfaces
CMD ["npm", "run", "dev", "--", "--host"]
