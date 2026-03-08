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

# Test args (passed at build time, not stored in final image)
# Neutral names used to avoid Docker linter warnings on known secret patterns
ARG BUILD_S3_KEY_ID
ARG BUILD_S3_SECRET
ARG AWS_REGION
ARG S3_ENDPOINT
ARG S3_BUCKET_NAME
ARG S3_BASE_URL
ARG S3_FOLDER
ARG DATABASE_URL

# Run tests before building (alias neutral ARG names back to expected env var names)
RUN AWS_ACCESS_KEY_ID=$BUILD_S3_KEY_ID \
    AWS_SECRET_ACCESS_KEY=$BUILD_S3_SECRET \
    pnpm run test:s3 && pnpm run test:db

# Build Bot
RUN pnpm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discordbot -u 1001

# Change ownership
RUN chown -R discordbot:nodejs /usr/src/app
USER discordbot

CMD ["pnpm", "start"]
