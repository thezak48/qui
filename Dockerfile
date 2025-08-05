# Build stage
FROM node:18-alpine AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# Go build stage
FROM golang:1.21-alpine AS go-builder

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
FROM alpine:latest

# Install CA certificates for HTTPS requests to Polar API
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S qui && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G qui -g qui qui

# Copy binary
COPY --from=go-builder /app/qui .

# Create data directory
RUN mkdir -p /app/data && chown -R qui:qui /app

USER qui

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["./qui"]