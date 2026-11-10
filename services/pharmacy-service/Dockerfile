# ==============================================================================                                                                                                                                                      
# STAGE 1: Dependencies Builder                                                                                                                                                                                                       
# ==============================================================================                                                                                                                                                      
FROM node:22-alpine AS deps                                                                                                                                                                                                           

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
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

# Security: Run as non-privileged 'node' user instead of 'root'
USER node

# Copy production dependencies from the 'deps' stage with correct user ownership
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy application source code and package metadata
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Expose microservice network port
EXPOSE 5001

# Start the application via server.js (graceful SIGTERM enabled)
CMD ["node", "src/server.js"]
