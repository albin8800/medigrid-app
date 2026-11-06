# ==============================================================================
# STAGE 1: Dependencies Builder
# ==============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package manifests first for Docker layer caching
COPY package*.json ./

# Install ONLY production dependencies strictly from package-lock.json
RUN npm ci --omit=dev

# ==============================================================================
# STAGE 2: Lightweight Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Security: Non-privileged user
USER node

# Copy production dependencies from 'deps' stage with node user ownership
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy application source code and metadata
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Expose microservice network port for order-service
EXPOSE 5002 

# Start the billing service with graceful shutdown support
CMD ["node", "src/server.js"]
