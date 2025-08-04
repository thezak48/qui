# Multi-stage Dockerfile for CI builds

# Build stage for Go binary
FROM golang:1.21-alpine AS go-builder

# Install build dependencies
RUN apk add --no-cache git make

# Build arguments for version info and Polar credentials
ARG VERSION=dev
ARG BUILDTIME
ARG REVISION
ARG BUILDER
ARG POLAR_ACCESS_TOKEN=""
ARG POLAR_ORG_ID=""
ARG POLAR_ENVIRONMENT="production"

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Copy pre-built frontend (from GitHub Actions artifact)
COPY internal/web/dist internal/web/dist

# Build the binary with ldflags
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="\
    -s -w \
    -X main.Version=${VERSION} \
    -X main.buildTime=${BUILDTIME} \
    -X main.commit=${REVISION} \
    -X main.PolarAccessToken=${POLAR_ACCESS_TOKEN} \
    -X main.PolarOrgID=${POLAR_ORG_ID} \
    -X main.PolarEnvironment=${POLAR_ENVIRONMENT}" \
    -o qbitweb ./cmd/server

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S qbitweb && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G qbitweb -g qbitweb qbitweb

# Copy binary from build stage
COPY --from=go-builder /app/qbitweb .

# Create data directory
RUN mkdir -p /app/data && chown -R qbitweb:qbitweb /app

USER qbitweb

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["./qbitweb"]