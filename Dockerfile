FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy source code
COPY . .

# Install dependencies
RUN npm ci --only=production

# Build Bot
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discordbot -u 1001

# Change ownership
RUN chown -R discordbot:nodejs /usr/src/app
USER discordbot

CMD ["npm", "start"]