FROM node:24-alpine

# Install ffmpeg and build tools
RUN apk add --no-cache ffmpeg python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build Bot
RUN pnpm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discordbot -u 1001

# Change ownership
RUN chown -R discordbot:nodejs /usr/src/app
USER discordbot

CMD ["pnpm", "start"]
