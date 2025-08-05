# Build stage
FROM node:22.18-alpine AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# Go build stage
FROM golang:1.24-alpine3.22 AS go-builder

# Install build dependencies
RUN apk add --no-cache git

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .
COPY --from=frontend-builder /app/web/dist ./web/dist

# Build arguments for baking in Polar credentials
ARG VERSION=dev
ARG POLAR_ACCESS_TOKEN=""
ARG POLAR_ORG_ID=""
ARG POLAR_ENVIRONMENT="production"

# Build the application with baked-in credentials
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w -X main.Version=${VERSION} -X main.PolarAccessToken=${POLAR_ACCESS_TOKEN} -X main.PolarOrgID=${POLAR_ORG_ID} -X main.PolarEnvironment=${POLAR_ENVIRONMENT}" \
    -o qui ./cmd/server

# Final stage
FROM alpine:3.22

LABEL org.opencontainers.image.source="https://github.com/autobrr/qui"

# Set environment variables for config paths
ENV HOME="/config" \
    XDG_CONFIG_HOME="/config" \
    XDG_DATA_HOME="/config"

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Declare volume for persistent data
VOLUME /config

# Copy binary
COPY --from=go-builder /app/qui /usr/local/bin/

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/qui"]