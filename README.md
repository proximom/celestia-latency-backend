# 🚀 Celestia RPC Latency Monitor - Backend

Multi-region RPC/gRPC endpoint monitoring system with latency tracking, health checks, and archival node detection.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [API Documentation](#api-documentation)
4. [Database Schema](#database-schema)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.x
- npm or yarn

### Installation

```bash
# 1. Create project directory
mkdir celestia-latency-backend
cd celestia-latency-backend

# 2. Initialize package.json (copy from artifact)
npm init -y

# 3. Install dependencies
npm install express sqlite3 winston dotenv joi cors helmet

# 4. Install dev dependencies
npm install --save-dev nodemon

# 5. Create directory structure
mkdir -p src/{config,controllers,services,models,middleware,utils,routes}
mkdir -p logs data migrations

# 6. Copy all source files from artifacts

# 7. Create .env file
cp .env.example .env
nano .env  # Edit with your settings
```

### Essential .env Configuration

```env
NODE_ENV=development
PORT=3000
API_KEY=change-this-to-a-secure-random-string
DB_PATH=./data/latency.db
LOG_LEVEL=info
```

### Start the Server

```bash
# Development mode (auto-reload on changes)
npm run dev

# Production mode
npm start
```

You should see:
```
🚀 Server running on port 3000
📊 Environment: development
🗄️  Database: ./data/latency.db
✅ Server ready to accept connections
```

---

## 🏗️ Architecture

### Flow Diagram

```
┌─────────────────┐
│ Hetzner Server  │
│   (Germany)     │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │  POST /api/upload-latency
│ Hetzner Server  │──┼──────────────────┐
│   (Singapore)   │  │                  ▼
└─────────────────┘  │         ┌─────────────────┐
                     │         │  Your Backend   │
┌─────────────────┐  │         │  (Express.js)   │
│ Hetzner Server  │──┘         │                 │
│      (USA)      │            │  ┌───────────┐  │
└─────────────────┘            │  │  SQLite   │  │
                               │  └───────────┘  │
                               └────────┬────────┘
                                        │
                               GET /api/latency/summary
                                        │
                               ┌────────▼────────┐
                               │   Dashboard     │
                               │  (Cloudflare)   │
                               └─────────────────┘
```

### Components

- **Express Server**: Handles HTTP requests
- **SQLite Database**: Stores endpoints and test results
- **Winston Logger**: Centralized logging
- **Services Layer**: Business logic
- **Controllers**: Request/response handling
- **Middleware**: Auth, validation, error handling

---

## 📡 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

Protected endpoints require `X-API-KEY` header:

```bash
curl -H "X-API-KEY: your-secret-key" ...
```

---

### Endpoints

#### 1. Health Check (Public)

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-13T10:00:00.000Z",
  "uptime": 3600
}
```

---

#### 2. Upload Latency Data (Protected)

```http
POST /api/upload-latency
```

**Headers:**
```
X-API-KEY: your-secret-key
Content-Type: application/json
```

**Body:**
```json
{
  "region": "EU-DE-FSN",
  "timestamp": "2025-12-13T10:00:00Z",
  "endpoints": [
    {
      "type": "rpc",
      "endpoint": "celestia-rpc.publicnode.com",
      "reachable": true,
      "timeout": false,
      "error": "",
      "http_status": "200",
      "latest_height": "1234567",
      "block1_status": "-",
      "latency_ms": 52,
      "chain": "celestia"
    },
    {
      "type": "grpc",
      "endpoint": "celestia-grpc.publicnode.com:443",
      "reachable": true,
      "timeout": false,
      "error": "",
      "http_status": "-",
      "latest_height": "-",
      "block1_status": "Has block 1",
      "latency_ms": 87,
      "chain": "celestia"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Latency data stored successfully",
  "data": {
    "region": "EU-DE-FSN",
    "inserted": 2,
    "errors": 0
  }
}
```

---

#### 3. Upload Monitoring (Protected, Alternative Format)

```http
POST /api/upload-monitoring?region=EU-DE-FSN
```

Accepts array of endpoints directly (for `monitor_endpoints.sh` compatibility).

---

#### 4. Get Summary (Public)

```http
GET /api/latency/summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "generated_at": "2025-12-13T10:00:00.000Z",
    "data_freshness_minutes": 60,
    "global": {
      "total_endpoints": 44,
      "online": 31,
      "offline": 13,
      "avg_latency_ms": 147,
      "min_latency_ms": 45,
      "max_latency_ms": 320,
      "success_rate": 0.7045,
      "total_tests": 264,
      "successful_tests": 186,
      "archival_grpc_online": 6,
      "archival_grpc_total": 8
    },
    "regions": [
      {
        "region": "EU-DE-FSN",
        "total_endpoints": 44,
        "online": 35,
        "offline": 9,
        "avg_latency_ms": 68,
        "min_latency_ms": 45,
        "max_latency_ms": 150,
        "success_rate": 0.7955,
        "total_tests": 44
      }
    ],
    "top_10_fastest": [
      {
        "endpoint": "celestia-rpc.publicnode.com",
        "chain": "celestia",
        "kind": "rpc",
        "is_archival": false,
        "avg_latency_global": 89,
        "min_latency": 45,
        "max_latency": 150,
        "regions_tested": 3,
        "times_reachable": 3,
        "success_rate": 1.0,
        "regions": ["EU-DE-FSN", "US-ASH", "SG-SIN"]
      }
    ]
  }
}
```

---

#### 5. Get Endpoint Details (Public)

```http
GET /api/latency/endpoint/:url
```

**Example:**
```bash
curl http://localhost:3000/api/latency/endpoint/celestia-rpc.publicnode.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "endpoint": "celestia-rpc.publicnode.com",
    "chain": "celestia",
    "kind": "rpc",
    "is_archival": false,
    "regional_performance": [
      {
        "region": "EU-DE-FSN",
        "reachable": 1,
        "latency_ms": 52,
        "block1_status": "-",
        "latest_height": 1234567,
        "timeout": 0,
        "ts": "2025-12-13 10:00:00"
      }
    ]
  }
}
```

---

## 🗄️ Database Schema

### Table: `endpoints`

```sql
CREATE TABLE endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain TEXT NOT NULL DEFAULT 'celestia',
  kind TEXT NOT NULL CHECK(kind IN ('rpc', 'grpc')),
  url TEXT NOT NULL,
  is_archival INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chain, kind, url)
);
```

### Table: `latency_runs`

```sql
CREATE TABLE latency_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reachable INTEGER NOT NULL DEFAULT 0,
  timeout INTEGER NOT NULL DEFAULT 0,
  latest_height INTEGER,
  block1_status TEXT,
  latency_ms INTEGER,
  error TEXT,
  http_status TEXT,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);
```

### Indexes

```sql
CREATE INDEX idx_endpoints_url ON endpoints(url);
CREATE INDEX idx_endpoints_kind ON endpoints(kind);
CREATE INDEX idx_latency_runs_endpoint ON latency_runs(endpoint_id);
CREATE INDEX idx_latency_runs_region ON latency_runs(region);
CREATE INDEX idx_latency_runs_ts ON latency_runs(ts DESC);
CREATE INDEX idx_latency_runs_reachable ON latency_runs(reachable);
CREATE INDEX idx_latency_runs_composite ON latency_runs(endpoint_id, region, ts DESC);
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3000 | Server port |
| `API_KEY` | - | **Required** - API authentication key |
| `DB_PATH` | ./data/latency.db | SQLite database file path |
| `LOG_LEVEL` | info | Logging level (error, warn, info, debug) |
| `LOG_FILE` | ./logs/app.log | Log file path |
| `DATA_FRESHNESS_MINUTES` | 60 | Time window for "recent" data |
| `MIN_REGIONS_FOR_TOP10` | 2 | Minimum regions tested to appear in top 10 |

---

## 🧪 Testing

### Run Tests

```bash
# Install axios for testing
npm install axios

# Run test script
node test.js
```

### Manual Testing with curl

**1. Upload test data:**

```bash
curl -X POST http://localhost:3000/api/upload-latency \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your-super-secret-api-key-change-this-in-production" \
  -d '{
    "region": "EU-DE-FSN",
    "timestamp": "2025-12-13T10:00:00Z",
    "endpoints": [
      {
        "type": "rpc",
        "endpoint": "celestia-rpc.publicnode.com",
        "reachable": true,
        "timeout": false,
        "error": "",
        "http_status": "200",
        "latest_height": "1234567",
        "block1_status": "-",
        "latency_ms": 52,
        "chain": "celestia"
      }
    ]
  }'
```

**2. Get summary:**

```bash
curl http://localhost:3000/api/latency/summary
```

**3. Test without API key (should fail):**

```bash
curl -X POST http://localhost:3000/api/upload-latency \
  -H "Content-Type: application/json" \
  -d '{"region": "test", "endpoints": []}'
```

---

## 🚀 Deployment

### Option 1: Railway (Easiest)

1. Sign up at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Connect your repo
4. Add environment variables in Railway dashboard
5. Deploy!

Railway will auto-detect Node.js and run `npm start`.

### Option 2: VPS (DigitalOcean, Hetzner, etc.)

```bash
# SSH into server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Clone your repo
git clone https://github.com/your-repo/celestia-backend.git
cd celestia-backend

# Install dependencies
npm install --production

# Set up .env
nano .env

# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start server.js --name celestia-backend
pm2 save
pm2 startup
```

### Option 3: Cloudflare Workers (Advanced)

Would require refactoring to use D1 database instead of SQLite.

---

## 🔧 Troubleshooting

### Database Locked Error

**Cause:** Multiple processes accessing SQLite simultaneously.

**Solution:**
```bash
# Enable WAL mode (already in code)
# Or increase timeout in database.js
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>

# Or change PORT in .env
PORT=3001
```

### API Key Rejected

Check:
1. `.env` file has correct `API_KEY`
2. Header is `X-API-KEY` (case-sensitive)
3. Server restarted after changing `.env`

### No Data in Summary

Check:
1. Data was uploaded successfully (check logs)
2. `DATA_FRESHNESS_MINUTES` isn't too short
3. Database file exists: `ls -la data/latency.db`

---

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
tail -f logs/app.log

# Error logs only
tail -f logs/error.log

# Search logs
grep "ERROR" logs/app.log
```

### Database Queries

```bash
# Open database
sqlite3 data/latency.db

# Check endpoints
SELECT * FROM endpoints;

# Check recent runs
SELECT * FROM latency_runs ORDER BY ts DESC LIMIT 10;

# Count by region
SELECT region, COUNT(*) FROM latency_runs GROUP BY region;
```

---

## 🎯 Next Steps

1. **Deploy backend** to Railway or VPS
2. **Test with real data** from one Hetzner server
3. **Scale to multiple regions**
4. **Connect dashboard** to `/api/latency/summary`
5. **Set up monitoring** (optional: add health check pings)

---

## 📝 License

MIT

---

## 🤝 Support

For issues or questions, check the logs first:
```bash
tail -f logs/app.log
```

Common issues are covered in [Troubleshooting](#troubleshooting).
