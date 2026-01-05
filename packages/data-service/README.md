# Data Service

A unified data service for Farmestly, providing access to multiple external data sources through a single API. Designed for load-balanced dual-node deployment via systemd.

## Overview

This service provides REST APIs for querying:
- **EPPO**: European and Mediterranean Plant Protection Organization plant codes and names
- **IngredientsEU**: EU active substances/pesticides database

Both providers use SQLite with FTS5 for fast full-text search capabilities.

## Features

- **Provider-based architecture** - Modular design for multiple data sources
- **Zero-downtime rebuilds** - Database rebuilds in background while old data keeps serving
- **Full-text search** - FTS5-powered prefix search with BM25 relevance ranking
- **Auto-fetch** - Both providers fetch data weekly via node-cron (EPPO Sundays 2AM, IngredientsEU Sundays 3AM)
- **Diacritic-insensitive search** - "cafe" matches "café", "λεμον" matches "λεμόνι"
- **Load-balanced safe** - File-based locking prevents concurrent builds across nodes
- **Direct access only** - Rejects proxied requests (nginx X-Forwarded-For headers)

## Requirements

- Node.js 18.x or later (uses native fetch)
- npm

## Installation

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

All environment variables are **required**. The service will exit with an error if any are missing.

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (e.g., `4000`) |
| `DATA_DIR` | Directory for all data files (e.g., `/var/farmestlydataproviders`) |
| `EPPO_API_URL` | EPPO API URL (`https://api.eppo.int/eppocodes/v2/datasets`) |
| `EPPO_API_KEY` | Your EPPO API key (x-api-key header) |
| `EPPO_TYPES` | EPPO code types to load (e.g., `PFL` for plants) |
| `INGREDIENTSEU_URL` | URL to fetch EU ingredients data from |

### Data Directory Structure

All data files are stored in the `DATA_DIR` (must be shared storage for load-balanced nodes):

```
/var/farmestlydataproviders/
├── eppo/
│   ├── *.xml                  # Downloaded EPPO XML (any filename)
│   ├── eppo_*.db              # SQLite database
│   └── build.lock             # Lock file during builds
└── ingredientseu/
    ├── data.json              # Downloaded JSON
    ├── ingredientseu_*.db     # SQLite database
    └── build.lock             # Lock file during builds
```

### Running

```bash
# Using .env file
npm start

# Or with environment variables
PORT=4000 \
DATA_DIR=/var/farmestlydataproviders \
EPPO_API_URL=https://api.eppo.int/eppocodes/v2/datasets \
EPPO_API_KEY=your-key \
EPPO_TYPES=PFL \
INGREDIENTSEU_URL=https://api.datalake.sante.service.ec.europa.eu/sante/pesticides/active-substances-download?format=json&api-version=v3.0 \
node index.js
```

---

## API Reference

### Root Endpoints

#### GET /
Returns service info and available endpoints.

#### GET /health
Returns overall service health.

---

## EPPO Provider (`/eppo`)

Provides access to EPPO plant codes and names. Data is fetched from the EPPO API.

### Data Fetching

On startup and weekly (Sundays 2AM):
1. Fetches dataset list from `EPPO_API_URL` with `x-api-key` header
2. Finds the "XML Full" dataset
3. Downloads the ZIP file
4. Extracts the XML and rebuilds the database

### POST /eppo/fetch

Manually triggers a data fetch from the EPPO API.

### GET /eppo/search

Full-text search across all active names and EPPO codes.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | query | yes | Search query - prefix matches names and codes |
| `lang` | query | no | Filter by language code (e.g., `en`, `de`, `la`) |
| `country` | query | no | Filter by country variant (e.g., `US`, `CA`) |
| `limit` | query | no | Max results (default: 100) |
| `offset` | query | no | Skip N results (default: 0) |

**Example:**
```bash
curl "http://localhost:4000/eppo/search?q=tomato&lang=en"
```

### GET /eppo/code/:eppocode

Returns full information about an EPPO code.

**Example:**
```bash
curl "http://localhost:4000/eppo/code/LYPES"
```

### GET /eppo/name/:eppocode

Returns a single name for an EPPO code in the specified language.

**Parameters:**
- `lang` (required): Language code
- `country` (optional): Country variant

**Example:**
```bash
curl "http://localhost:4000/eppo/name/LYPES?lang=en"
```

### POST /eppo/rebuild

Triggers a database rebuild from the existing XML file.

### GET /eppo/health

Returns EPPO provider health and statistics.

---

## IngredientsEU Provider (`/ingredientseu`)

Provides access to EU active substances/pesticides data.

### Data Fetching

On startup and weekly (Sundays 3AM):
1. Fetches JSON data from `INGREDIENTSEU_URL`
2. Saves to `data.json` and rebuilds the database

### POST /ingredientseu/fetch

Manually triggers a data fetch from the configured URL.

### GET /ingredientseu/search

Full-text search across substances.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | query | yes | Search query |
| `status` | query | no | Filter by status (Approved/Not approved) |
| `category` | query | no | Filter by category (FU, IN, HB, etc.) |
| `limit` | query | no | Max results (default: 100) |
| `offset` | query | no | Skip N results (default: 0) |

**Example:**
```bash
curl "http://localhost:4000/ingredientseu/search?q=glyphosate"
curl "http://localhost:4000/ingredientseu/search?q=benzovindiflupyr&status=Approved"
```

### GET /ingredientseu/substance/:id

Returns full substance details by ID.

**Example:**
```bash
curl "http://localhost:4000/ingredientseu/substance/1204"
```

### GET /ingredientseu/cas/:cas

Returns substance by CAS number.

**Example:**
```bash
curl "http://localhost:4000/ingredientseu/cas/1072957-71-1"
```

### POST /ingredientseu/rebuild

Triggers a database rebuild from the existing JSON file.

### GET /ingredientseu/health

Returns provider health and statistics.

---

## Substance Categories

| Code | Description |
|------|-------------|
| `FU` | Fungicide |
| `IN` | Insecticide |
| `HB` | Herbicide |
| `AT` | Attractant |
| `AC` | Acaricide |
| `RO` | Rodenticide |

---

## Folder Structure

```
packages/data-service/
├── index.js                    # Main entry point
├── package.json
├── .env.example                # Example configuration
├── providers/
│   ├── eppo/
│   │   └── index.js            # EPPO provider
│   └── ingredientseu/
│       └── index.js            # EU ingredients provider
└── shared/
    ├── config.js               # Environment validation
    └── utils.js                # Shared utilities
```

---

## Deployment

### Load-Balanced Dual-Node Setup

This service is designed for load-balanced deployment across two nodes. Key considerations:

1. **Shared Storage**: `DATA_DIR` must be on shared storage (NFS, GlusterFS, etc.) accessible by all nodes
2. **File Locking**: Atomic file locks prevent concurrent database builds across nodes
3. **Stale Lock Recovery**: Locks older than 30 minutes are automatically removed (handles node crashes)
4. **Cron Scheduling**: Both nodes have the same cron schedule; file locking ensures only one builds

### Systemd Service

Create `/etc/systemd/system/data-service.service` on each node:

```ini
[Unit]
Description=Farmestly Data Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/farmestly/packages/data-service
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3
Environment=PORT=4000
Environment=DATA_DIR=/var/farmestlydataproviders
Environment=EPPO_API_URL=https://api.eppo.int/eppocodes/v2/datasets
Environment=EPPO_API_KEY=your-api-key
Environment=EPPO_TYPES=PFL
Environment=INGREDIENTSEU_URL=https://api.datalake.sante.service.ec.europa.eu/sante/pesticides/active-substances-download?format=json&api-version=v3.0

MemoryMax=512M
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable data-service
sudo systemctl start data-service
```

### Nginx Configuration

The data-service rejects proxied requests. Configure nginx to proxy from farmestly-service only:

```nginx
# In farmestly-service nginx config
location /data/ {
    proxy_pass http://farmestly-service-upstream;
    # farmestly-service handles the internal proxy to data-service
}
```

Do NOT proxy directly to data-service from nginx - it will be rejected (403).

---

## Integration with farmestly-service

The main API proxies requests through `/data/*`:

```
GET /data/eppo/search         → http://127.0.0.1:4000/eppo/search
GET /data/ingredientseu/search → http://127.0.0.1:4000/ingredientseu/search
```

Configure in farmestly-service:
```
DATA_SERVICE_URL=http://127.0.0.1:4000
```

---

## License

EPPO codes are freely available under open data license from EPPO.
EU active substances data is from the European Commission.
