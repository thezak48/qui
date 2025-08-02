# qBittorrent WebUI

A modern, self-hosted alternative web interface for qBittorrent designed for personal use. Supports multiple qBittorrent instances and handles large-scale deployments (10k+ torrents) while maintaining simplicity and ease of deployment.

## Features

- **Self-Hosted**: Run on your personal server, NAS, or homelab
- **Single User**: Simple authentication without complex user management
- **Multi-Instance**: Manage multiple qBittorrent instances from one interface
- **Performance**: Optimized for 10k+ torrents using SyncMainData API
- **Single Binary**: Easy deployment with embedded frontend assets

## Quick Start

### Prerequisites

- Go 1.21+ (for building from source)
- Node.js 20+ and pnpm (for frontend development)
- Running qBittorrent instance(s) with Web UI enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/s0up4200/qbitweb.git
cd qbitweb

# Build the application
make build

# Run the application
./qbitweb
```

The application will be available at http://localhost:8080

### Configuration

On first run, a `config.toml` file will be created with default settings. You can also use environment variables:

```bash
QBITWEB__HOST=0.0.0.0
QBITWEB__PORT=8080
QBITWEB__SESSION_SECRET=your-secret-key
```

## Development

### Backend Development

```bash
# Install dependencies
go mod download

# Run with hot reload
make dev-backend
```

### Frontend Development

```bash
# Install dependencies
cd web && pnpm install

# Run development server
make dev-frontend
```

## Architecture

- **Backend**: Go with Chi router, SQLite database, and embedded frontend
- **Frontend**: React 19 with Vite, TanStack libraries, and shadcn/ui
- **API**: RESTful with session-based authentication
- **Performance**: SyncMainData API for efficient updates with large torrent counts

## License

[Add your license here]