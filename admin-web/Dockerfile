FROM node:22-alpine

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all application files
COPY . .

# Set environment to prevent React from trying to launch a browser in the container
ENV BROWSER=none
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
