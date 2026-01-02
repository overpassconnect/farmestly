# EPPO Code Lookup Service

A lightweight, high-performance Node.js service for querying EPPO (European and Mediterranean Plant Protection Organization) codes and their associated names.

## Overview

This service parses EPPO XML data files and provides a REST API for querying:
- Scientific names (Latin)
- Common names in multiple languages
- Country-specific name variants
- Full-text search across all names

The service uses SQLite for fast queries and supports hot-reloading when the source XML file changes.

## Features

- **Zero-downtime rebuilds** - Database rebuilds in background while old data keeps serving
- **Auto-reload** - Polls for XML file changes and rebuilds automatically (60s interval)
- **Full-text search** - FTS5-powered prefix search with BM25 relevance ranking, diacritic-insensitive
- **Multilingual** - Supports all languages in EPPO data with country variants
- **Resilient** - Handles invalid XML gracefully, continues serving old data

## Requirements

- Node.js 14.x or later
- npm

## Installation

```bash
npm install express better-sqlite3 sax
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EPPO_XML` | `./fullcodes.xml` | Path to EPPO XML file |
| `EPPO_PORT` | `4000` | HTTP server port |
| `EPPO_TYPES` | `PFL` | Comma-separated code types to load |

### Running

```bash
# Linux/macOS
EPPO_XML=./data/fullcodes.xml EPPO_PORT=3001 node index.js

# Windows PowerShell
$env:EPPO_XML=".\data\fullcodes.xml"; $env:EPPO_PORT=3001; node .\index.js
```

---

## API Reference

All responses include a `_meta` object:

```json
{
  "_meta": {
    "dataDate": "2025-12-30T03:31:47+01:00",
    "version": "1.0",
    "types": "PFL",
    "builtAt": "2025-01-02T12:00:00.000Z"
  }
}
```

---

### GET /code/:eppocode

Returns full information about an EPPO code including all active names.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eppocode` | path | yes | EPPO code (case-insensitive) |
| `lang` | query | no | Filter names by language code |

**Example:**

```bash
curl http://localhost:4000/code/LYOCL
curl http://localhost:4000/code/LYOCL?lang=en
```

**Response:**

```json
{
  "_meta": { ... },
  "code": {
    "id": 36917,
    "eppocode": "LYOCL",
    "type": "PFL",
    "creation": "1996-10-28",
    "modification": "1996-10-28",
    "preferred": {
      "fullname": "Lycopodium clavatum",
      "lang": "la",
      "authority": "Linnaeus"
    }
  },
  "names": [
    {
      "id": 118183,
      "fullname": "Lycopodium clavatum",
      "lang": "la",
      "langcountry": null,
      "authority": "Linnaeus",
      "ispreferred": true,
      "creation": "1996-10-28",
      "modification": "1996-10-28"
    }
  ]
}
```

**Status Codes:** `200` Success | `404` Not found | `500` Error | `503` DB not ready

---

### GET /name/:eppocode

Returns a single name for an EPPO code in the specified language.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eppocode` | path | yes | EPPO code (case-insensitive) |
| `lang` | query | yes | Language code (e.g., `en`, `de`, `la`) |
| `country` | query | no | Country code for regional variant (e.g., `US`, `CA`) |

**Fallback Logic:**

1. Exact match: language + country (if country provided)
2. Generic: language with no country specified
3. Any active name in that language

**Example:**

```bash
# Get English name (generic)
curl "http://localhost:4000/name/LYOCL?lang=en"

# Get US English name
curl "http://localhost:4000/name/LYOCL?lang=en&country=US"

# Get scientific name (Latin)
curl "http://localhost:4000/name/LYOCL?lang=la"
```

**Response:**

```json
{
  "_meta": { ... },
  "name": {
    "fullname": "common clubmoss",
    "lang": "en",
    "langcountry": null,
    "authority": null,
    "ispreferred": false
  }
}
```

**Status Codes:** `200` Success | `400` Missing lang | `404` Not found | `500` Error | `503` DB not ready

---

### GET /search

Full-text prefix search across all active names and EPPO codes using SQLite FTS5 with BM25 relevance ranking.

**Search Features:**

- **Prefix matching** - "toma" matches "tomato", "tomate", etc.
- **EPPO code search** - "LYPE" matches "LYPES"
- **Diacritic-insensitive** - "cafe" matches "café", "λεμον" matches "λεμόνι"
- **Special characters** - Commas, quotes, and other characters are safely escaped
- **Multilingual** - Works with Latin, Greek, Cyrillic, Arabic scripts and more

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | query | yes | Search query - prefix matches names and EPPO codes |
| `lang` | query | no | Filter by language code (e.g., `en`, `de`, `la`) |
| `country` | query | no | Filter by country variant (e.g., `US`, `CA`, `GB`) |
| `limit` | query | no | Max results per page (default: 100) |
| `offset` | query | no | Skip N results for pagination (default: 0) |

**Example:**

```bash
# Basic search
curl "http://localhost:4000/search?q=clubmoss"

# Prefix search - "toma" matches "tomato"
curl "http://localhost:4000/search?q=toma"

# Search by EPPO code prefix
curl "http://localhost:4000/search?q=LYPE"

# Diacritic-insensitive - "cafe" matches "café"
curl "http://localhost:4000/search?q=cafe"

# Greek without accents - "λεμον" matches "λεμόνι"
curl "http://localhost:4000/search?q=λεμον"

# Filter by language
curl "http://localhost:4000/search?q=Lycopodium&lang=la"

# Filter by language and country
curl "http://localhost:4000/search?q=corn&lang=en&country=US"

# Pagination
curl "http://localhost:4000/search?q=wolf&limit=20&offset=40"
```

**Response:**

```json
{
  "_meta": { ... },
  "results": [
    {
      "eppocode": "LYPES",
      "fullname": "tomato",
      "lang": "en",
      "langcountry": null,
      "ispreferred": false,
      "preferred": "Solanum lycopersicum"
    }
  ],
  "total": 156,
  "limit": 100,
  "offset": 0
}
```

**Pagination:**

Results are sorted by BM25 relevance score (best matches first). Use `total`, `limit`, and `offset` to implement pagination:

- Page 1: `?q=tomato&limit=20&offset=0`
- Page 2: `?q=tomato&limit=20&offset=20`
- Page 3: `?q=tomato&limit=20&offset=40`

**Status Codes:** `200` Success | `400` Missing q | `500` Error | `503` DB not ready

---

### POST /rebuild

Triggers a database rebuild. Optionally change the code types to load.

**Request Body (optional):**

```json
{
  "types": "PFL,PST"
}
```

**Example:**

```bash
# Rebuild with current types
curl -X POST http://localhost:4000/rebuild

# Rebuild with new types
curl -X POST http://localhost:4000/rebuild \
  -H "Content-Type: application/json" \
  -d '{"types": "PFL,PST"}'
```

**Response:**

```json
{
  "_meta": { ... },
  "ok": true,
  "codes": 59195,
  "names": 393472,
  "meta": {
    "dateexport": "2025-12-30T03:31:47+01:00",
    "version": "1.0",
    "builtAt": "2025-01-02T12:00:00.000Z"
  }
}
```

---

### GET /health

Returns service health and statistics.

**Example:**

```bash
curl http://localhost:4000/health
```

**Response (healthy):**

```json
{
  "_meta": { ... },
  "ok": true,
  "rebuilding": false,
  "stats": {
    "codes": 59195,
    "names": 393472,
    "namesActive": 357871
  },
  "memory": {
    "heapUsed": "45 MB",
    "rss": "89 MB"
  },
  "dbFile": "fullcodes_1704200000000.db",
  "dbSize": "52 MB"
}
```

**Response (unhealthy):**

```json
{
  "_meta": { ... },
  "ok": false,
  "error": "database not loaded - XML may be invalid",
  "rebuilding": false,
  "memory": {
    "heapUsed": "12 MB",
    "rss": "45 MB"
  }
}
```

---

## Data Model

### EPPO Codes

| Field | Description |
|-------|-------------|
| `id` | Internal EPPO database ID |
| `eppocode` | 5-6 letter unique identifier |
| `type` | Code type (PFL=plant, etc.) |
| `creation` | Date code was created |
| `modification` | Date code was last modified |

### Names

| Field | Description |
|-------|-------------|
| `id` | Internal name ID |
| `eppocode` | Parent EPPO code |
| `fullname` | The name string |
| `lang` | ISO language code (e.g., `en`, `de`, `la`) |
| `langcountry` | Country variant (e.g., `US`, `CA`) or null |
| `authority` | Taxonomic authority (for scientific names) |
| `ispreferred` | `true` = preferred scientific name, `false` = other |
| `isactive` | 1 = current, 0 = deprecated |

### Understanding `ispreferred`

The `ispreferred` flag marks the **current accepted scientific name**:
- Always Latin (`lang=la`)
- Only ONE preferred name per EPPO code
- Common names are never marked as preferred
- When taxonomy changes, the preferred name updates but the EPPO code stays the same

---

## Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/eppo.service`:

```ini
[Unit]
Description=EPPO Lookup Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/eppo
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3
Environment=EPPO_XML=/opt/eppo/data/fullcodes.xml
Environment=EPPO_PORT=4000
Environment=EPPO_TYPES=PFL

MemoryMax=512M
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable eppo
sudo systemctl start eppo

# Check status
sudo systemctl status eppo
journalctl -u eppo -f
```

### Nginx Reverse Proxy

```nginx
location /eppo/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid XML on startup | Service starts, returns 503, polls for valid XML |
| Invalid XML during rebuild | Old DB keeps serving, error logged |
| XML fixed later | Next poll cycle (60s) rebuilds successfully |
| Service crash | Systemd restarts in 3 seconds |

---

## Code Types

Common EPPO code types:

| Type | Description |
|------|-------------|
| `PFL` | Plants (cultivated, wild, weeds) |
| `PST` | Pests |
| `DIS` | Diseases |
| `1XXXG` | Genus level |
| `1XXXF` | Family level |

Load multiple types:

```bash
EPPO_TYPES=PFL,PST node index.js
```

Or via API:

```bash
curl -X POST http://localhost:4000/rebuild \
  -H "Content-Type: application/json" \
  -d '{"types": "PFL,PST"}'
```

---

## Supported Languages

The EPPO database includes names in many languages. Common language codes:

| Code | Language | Script |
|------|----------|--------|
| `la` | Latin (scientific) | Latin |
| `en` | English | Latin |
| `de` | German | Latin |
| `fr` | French | Latin |
| `es` | Spanish | Latin |
| `el` | Greek | Greek |
| `ru` | Russian | Cyrillic |
| `ar` | Arabic | Arabic |
| `he` | Hebrew | Romanized |
| `ja` | Japanese | Romanized |
| `ms` | Malay | Latin |

Note: Some languages (Hebrew, Japanese) use romanized transliterations in the EPPO data rather than native script.

---

## License

EPPO codes are freely available under the terms of an open data license from EPPO.
See: https://www.eppo.int/RESOURCES/eppo_databases/eppo_codes