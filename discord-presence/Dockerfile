# Tiny container for the presence worker. ~50 MB image, ~30 MB RAM at runtime.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy app source
COPY presence.js ./

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app
USER app

CMD ["node", "presence.js"]
