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
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION
ARG S3_ENDPOINT
ARG S3_BUCKET_NAME
ARG S3_BASE_URL
ARG S3_FOLDER
ARG NEON_DB_URL

# Run tests before building
RUN echo "S3_ENDPOINT=$S3_ENDPOINT" && echo "S3_BUCKET_NAME=$S3_BUCKET_NAME" && pnpm run test:s3 && pnpm run test:db

# Build Bot
RUN pnpm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S discordbot -u 1001

# Change ownership
RUN chown -R discordbot:nodejs /usr/src/app
USER discordbot

CMD ["pnpm", "start"]
