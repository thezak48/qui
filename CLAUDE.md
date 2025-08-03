# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

qBittorrent Alternative WebUI - a self-hosted, single-user web interface for managing multiple qBittorrent instances. Built with Go backend and React frontend, optimized for handling 10k+ torrents.

**Important**: See `prd_final.md` for the complete implementation plan, architecture details, and technical specifications.

## Development Commands

### Backend (Go)
```bash
# Install dependencies
go mod download

# Build backend
go build -ldflags "-X main.Version=$(git describe --tags --always)" -o qbitweb ./cmd/server

# Run backend in development
air -c .air.toml  # Hot reload

# Run tests
go test ./...

# Run specific test
go test -v -run TestFunctionName ./path/to/package

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Frontend (React/TypeScript)
```bash
# Install dependencies
cd web && pnpm install

# Run frontend in development
cd web && pnpm dev

# Build frontend for production
cd web && pnpm build

# Lint frontend code
cd web && pnpm lint

# Type check (no test script defined yet)
cd web && pnpm tsc -b
```

### Full Build
```bash
# Build both frontend and backend into single binary
make build

# Development mode (run both frontend and backend)
make dev

# Run backend with hot reload
make dev-backend

# Run frontend development server
make dev-frontend

# Format code
make fmt

# Lint code
make lint

# Install all dependencies
make deps

# Clean build artifacts
make clean
```

## Architecture

### Backend Architecture
- **Framework**: Chi router (github.com/go-chi/chi/v5)
- **Database**: SQLite via modernc.org/sqlite (CGO-free)
- **qBittorrent Client**: github.com/autobrr/go-qbittorrent
- **Session Management**: gorilla/sessions with secure cookies
- **Configuration**: Viper with TOML config and environment overrides
- **Performance**: Ristretto cache, ants/v2 goroutine pool

Key patterns:
- Frontend assets embedded using `go:embed` 
- Single user authentication (no multi-tenancy)
- Connection pooling for multiple qBittorrent instances
- SyncMainData for efficient updates with 10k+ torrents

### Frontend Architecture
- **Build**: Vite with React 19 and TypeScript
- **Routing**: TanStack Router for type-safe routes
- **Data**: TanStack Query for server state, TanStack Form for forms
- **UI**: shadcn/ui components exclusively (no custom modifications)
- **Tables**: TanStack Table v8 with TanStack Virtual for performance
- **Styling**: Tailwind CSS v4 with CSS-first configuration

#### Important: shadcn/ui Component Installation
When installing shadcn/ui components, they MUST be installed in the correct location:
- **Correct**: `web/src/components/ui/`
- **Wrong**: `web/@/components/ui/`

The components.json file should have been configured during setup to use `src/components/ui` as the component path. If components are installed in the wrong location, move them to `web/src/components/ui/`.

Key patterns:
- Server-side operations for large datasets
- Virtual scrolling for performance
- Incremental sync updates via SyncMainData
- Progressive loading for initial render

## Performance Considerations

When handling 10k+ torrents:
1. Use SyncMainData API for incremental updates (2-second polling)
2. Initial load limited to 100-200 torrents with pagination
3. Virtual scrolling with progressive loading
4. Server-side filtering/sorting/pagination
5. Aggressive caching with Ristretto

## Configuration

Environment variables use `QBITWEB__` prefix:
- `QBITWEB__HOST` (default: localhost or 0.0.0.0 in containers)
- `QBITWEB__PORT` (default: 8080)
- `QBITWEB__SESSION_SECRET` (auto-generated if not set)
- `QBITWEB__DATABASE_PATH` (default: ./data/qbitweb.db)
- `QBITWEB__LOG_LEVEL` (ERROR, DEBUG, INFO, WARN, TRACE)

Config file: `config.toml` (auto-created on first run)

## API Endpoints

Protected routes require authentication via session cookie or API key header (`X-API-Key`).

- `POST /api/auth/setup` - Initial user setup
- `POST /api/auth/login` - User login
- `GET /api/instances` - List all instances
- `POST /api/instances` - Add new instance
- `GET /api/instances/{id}/torrents` - Get torrents (paginated)
- `GET /api/instances/{id}/torrents/sync` - SyncMainData endpoint
- `POST /api/instances/{id}/torrents` - Add torrent
- `POST /api/instances/{id}/torrents/bulk-action` - Bulk operations

## Database Schema

Single-user design with encrypted instance credentials:
- `user` table - Single record enforced
- `api_keys` table - For automation/scripts
- `instances` table - qBittorrent instance connections

## Testing Strategy

- Backend: Table-driven tests for handlers
- Frontend: React Testing Library for components
- E2E: Playwright for critical user flows
- Load testing: Simulate 10k+ torrents scenario

## Commit Guidelines

Follow Conventional Commit format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build process or auxiliary tool changes

**CRITICAL**: Never reference Claude or Claude Code in any commit messages

## Commit Co-Authors

- **Important**: Never add co-authors to commits at all

## Common Development Workflows

### Adding a New API Endpoint
1. Define handler in `internal/api/handlers/`
2. Add route in `internal/api/router.go`
3. Update frontend API client in `web/src/lib/api.ts`
4. Add TypeScript types in `web/src/types/index.ts`
5. Create React Query hook in `web/src/hooks/`

### Adding a New shadcn/ui Component
```bash
cd web
pnpm dlx shadcn@latest add <component-name>
# Components will be installed in web/src/components/ui/
```

### Debugging Performance Issues
1. Check backend logs with `LOG_LEVEL=DEBUG`
2. Monitor cache hit rates in sync_manager.go
3. Use browser DevTools Performance tab for frontend
4. Check virtual scrolling in TorrentTableOptimized.tsx

## Key Implementation Details

### Backend
- **Database Migrations**: Auto-run on startup via `internal/database/migrations.go`
- **Instance Connections**: Pooled and health-checked every 30 seconds
- **Password Storage**: Argon2id hashing with secure defaults
- **Session Management**: HTTP-only cookies with CSRF protection
- **API Response Format**: Always camelCase JSON (handled by converters)

### Frontend
- **Route Guards**: Authentication checked in `_authenticated.tsx` layout
- **Real-time Updates**: 
  - Dashboard uses 10-second polling for stats
  - Torrent table uses SyncMainData (currently disabled in favor of paginated API)
- **State Management**: 
  - Server state: TanStack Query with 30s stale time
  - UI state: React useState/useReducer
- **Virtual Scrolling**: Progressive loading starting at 100 rows
- **Column Resizing**: Persisted in component state (not localStorage)
- **Torrent Details**: 
  - Click torrent row to view details panel below table
  - Tabs for General, Trackers, and Content (Files)
  - Responsive split layout (side-by-side on desktop, stacked on mobile)

### Critical Files
- `internal/qbittorrent/sync_manager.go` - Handles all torrent operations and caching
- `web/src/hooks/useTorrentsList.ts` - Main hook for torrent data fetching
- `web/src/components/torrents/TorrentTableOptimized.tsx` - Virtual scrolling implementation with torrent details
- `web/src/components/torrents/TorrentDetailsPanel.tsx` - Torrent details panel with tabs
- `internal/api/handlers/torrents.go` - Backend filtering and pagination logic

## Known Issues and Workarounds
- SyncMainData implementation exists but is currently unused due to complexity
- Tags can be either string[] or comma-separated string from API
- Instance status requires periodic health checks due to connection drops

## Cache Management and Real-time Updates

### Backend Cache Strategy
The backend uses Ristretto cache with **2-second TTL** for torrent data to ensure responsive updates after user actions. Key considerations:

- **Cache Invalidation**: Immediately clear cache after bulk actions (pause/resume/delete) and adding torrents
- **qBittorrent Processing Time**: qBittorrent needs time to process actions before its API reflects changes
- **Cache TTL**: Reduced from 10-30 seconds to 2 seconds for better responsiveness

### Frontend Update Strategy
Frontend uses coordinated timing with backend for optimal user experience:

- **TorrentActions**: 1-second delay before React Query invalidation
- **AddTorrentDialog**: 500ms delay before React Query invalidation  
- **React Query**: 5-second stale time with `exact: false` invalidation to match all related queries

### Implementation Pattern
```go
// Backend: Immediate cache clear after action
h.syncManager.BulkAction(ctx, instanceID, hashes, action)
h.syncManager.InvalidateCache(instanceID) // Clear entire cache

// Frontend: Delayed invalidation to allow qBittorrent processing
setTimeout(() => {
  queryClient.invalidateQueries({ 
    queryKey: ['torrents-list', instanceId],
    exact: false 
  })
}, 1000) // 1 second for actions, 500ms for adding torrents
```

This approach ensures:
1. Actions return immediately (good UX)  
2. Backend cache is cleared immediately
3. Frontend waits for qBittorrent to process changes
4. Next API call gets fresh data with updated torrent states