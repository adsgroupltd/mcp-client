# ------------------------------------------------------------
# Stage 1 – build Angular (node)
# ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# ---------- Install Angular CLI ----------
RUN npm install -g @angular/cli@17

# ---------- Build client ----------
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN ng build --configuration production

# ---------- Install server deps ----------
COPY package*.json tsconfig.json ./
RUN npm ci   # installs express, cors, typescript, ts-node ...

# ---------- Compile server ----------
COPY server/ ./server/
RUN npx tsc   # uses tsconfig.json, outputs to server/dist

# ------------------------------------------------------------
# Stage 2 – runtime (node)
# ------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Copy only the runtime artefacts from builder
COPY --from=builder /app/client/dist/client ./client/dist/client
COPY --from=builder /app/server/dist ./server/dist
COPY package*.json tsconfig.json ./

# Install only production deps (express, cors)
ENV NODE_ENV=production
RUN npm ci --only=production

# Optional: expose a volume for the registry file
VOLUME ["/app"]   # allows mounting mcp.json from host

EXPOSE 3000

# Start the Express server (which also serves Angular)
CMD ["node", "server/dist/index.js"]
