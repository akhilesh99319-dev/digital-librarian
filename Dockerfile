# Production Dockerfile for Digital Librarian
FROM node:24-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create uploads directory and database directory
RUN mkdir -p uploads database

# Environment Defaults
ENV PORT=3000
ENV NODE_ENV=production
ENV FINE_RATE_PER_DAY=5

EXPOSE 3000

# Start server
CMD ["node", "backend/server.js"]
