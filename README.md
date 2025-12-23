# 🚀 Celestia RPC Latency Monitor - Backend & Orchestrator

Multi-region RPC/gRPC endpoint monitoring system with latency tracking, health checks, archival node detection, and a remote-execution orchestrator.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Orchestration Workflow](#orchestration-workflow)
4. [API Documentation](#api-documentation)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Testing](#testing)
8. [Deployment](#deployment)

---

## 🚀 Quick Start

### Prerequisites

- **Backend**: Node.js >= 16.x, `npm`
- **Orchestrator**: Python 3.x, `pip` for `requests`, `python-dotenv`, `tabulate`

### Installation & Setup

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd celestia-latency-backend

# 2. Install backend dependencies
npm install

# 3. Install orchestrator dependencies
pip install -r celestia-orchestrator/requirements.txt

# 4. Create backend .env file and configure it
cp .env.example .env
nano .env # Set API_KEY, DB_TYPE, DATABASE_URL etc.

# 5. Create orchestrator .env file
cp celestia-orchestrator/.env.example celestia-orchestrator/.env
nano celestia-orchestrator/.env # Set HETZNER_API_TOKEN
```

### Start the Server

```bash
# Development mode (auto-reload on changes)
npm run dev

# Production mode
npm start
```

---

## 🏗️ Architecture

This project consists of three main components that work together.

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
│     Orchestrator        │      │     Monitoring Nodes     │      │        Backend           │
│ (manage_servers.py,     │─────▶│  (Hetzner Servers)       │─────▶│  (Express.js + Postgres) │
│  setup_and_run_remote.sh)│      │(run monitor_endpoints.sh)│      │                          │
└─────────────────────────┘      └──────────────────────────┘      └────────────┬─────────────┘
                                                                                 │
                                                                                 │ GET /api/latency/summary
                                                                                 │
                                                                       ┌─────────▼─────────┐
                                                                       │     Dashboard     │
                                                                       │  (celestia-frontend)│
                                                                       └───────────────────┘
```

1.  **Backend (`/src`)**: A Node.js/Express application with a PostgreSQL database that ingests, aggregates, and serves latency data via a JSON API.
2.  **Monitoring Script (`/scripts`)**: A powerful shell script (`monitor_endpoints.sh`) that runs on remote servers to test RPC/gRPC endpoints and measure latency.
3.  **Orchestrator (`/celestia-orchestrator`)**: A set of Python and shell scripts to automate the management of remote monitoring nodes (e.g., on Hetzner Cloud) and execute the monitoring script on them.

---

## ⚙️ Orchestration Workflow

The `celestia-orchestrator` directory contains tools to automate the deployment and execution of the monitoring script across multiple servers.

### Step 1: Manage Monitoring Servers

Use the `manage_servers.py` script to easily power your Hetzner Cloud servers on or off.

```bash
# Navigate to the orchestrator directory
cd celestia-orchestrator

# Run the manager
python manage_servers.py
```

This will present an interactive menu where you can list all your servers and choose which ones to start or stop. This is useful for saving costs by only running monitoring nodes when needed.

### Step 2: Execute Monitoring on Remote Servers

The `setup_and_run_remote.sh` script is the core of the orchestration. **It is designed to be executed on your remote servers**, typically via SSH. Its job is to prepare the server and run the monitor.

**Example of how you would run it from your local machine:**

```bash
# Example for a server in Ashburn, VA
SERVER_IP="<your-ash-server-ip>"
REGION="ash"
API_KEY="<your-backend-api-key>"

# Use SSH to execute the setup script on the remote server
ssh root@${SERVER_IP} 'bash -s' -- < cat ./setup_and_run_remote.sh "${REGION}" "${API_KEY}"
```

### What `setup_and_run_remote.sh` Does:

1.  **Installs Dependencies**: It automatically detects the OS (Debian, Fedora, etc.) and installs `git`, `curl`, `jq`, and `grpcurl`.
2.  **Clones/Updates Repo**: It clones the `monitor-endpoints-sh` repository from GitHub. If it already exists, it pulls the latest changes.
3.  **Patches the Script**: It dynamically modifies `monitor_endpoints.sh` on the remote server to ensure it uploads data to your specific backend URL (`https://celestia-latency-backend.onrender.com`) and includes verbose `curl` output for debugging.
4.  **Executes Monitoring**: It runs the `monitor_endpoints.sh` script, which performs all latency tests.
5.  **Uploads Data**: The script then POSTs the final JSON results to your backend.

This flow allows you to turn on a server with `manage_servers.py` and then immediately run a full monitoring and data upload cycle with a single SSH command.

---

## 📡 API Documentation

### Get Summary (Public)

This is the primary endpoint for the dashboard. It provides a comprehensive, aggregated view of the network's health.

```http
GET /api/latency/summary
```

**Response Body (`success`):**

```json
{
  "success": true,
  "data": {
    "generated_at": "2025-12-22T22:00:20.790Z",
    "data_freshness_minutes": 60,
    "global": {
      "total_endpoints": 53,
      "online": 41,
      "offline": 12,
      "avg_latency_ms": 189,
      "success_rate": 0.7736,
      "total_tests": 150,
      "successful_tests": 116,
      "archival_grpc_total": 5,
      "rpc_total": 30,
      "rpc_online": 22,
      "grpc_total": 23,
      "grpc_online": 19
    },
    "regions": [
      {
        "region": "ash",
        "total_endpoints": 53,
        "online": 41,
        "offline": 12,
        "avg_latency_ms": 150,
        "success_rate": 0.7736,
        "total_tests": 53,
        "bestRpc": {
          "url": "celestia-rpc.publicnode.com",
          "latency_ms": 99
        }
      }
    ],
    "top_15_fastest": [
      {
        "endpoint": "celestia-rpc.publicnode.com",
        "kind": "rpc",
        "is_archival": false,
        "avg_latency_global": 123,
        "regions_tested": 3,
        "regions": ["ash", "fsn", "nbg1"]
      }
    ],
    "top_3_latest": [
      {
        "url": "celestia-rpc.easy2stake.com",
        "region": "fsn",
        "latency_ms": 135
      }
    ]
  }
}
```

*(For other endpoints like `/health` and `/api/upload-latency`, see the original documentation below, as they are unchanged).*

---

## 🗄️ Database Schema

The database schema uses two main tables: `endpoints` and `latency_runs`. It is designed to efficiently store and query time-series latency data.

*(Schema details unchanged, see original docs below)*

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` or `production` |
| `PORT` | `3000` | Server port |
| `API_KEY` | - | **Required** - Secret key for data upload endpoints |
| `DB_TYPE` | `sqlite` | Database type: `sqlite` or `postgres` |
| `DATABASE_URL` | - | **Required for Postgres** - Connection string |
| `DB_PATH` | `./data/latency.db` | Path for SQLite database file |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `DATA_FRESHNESS_MINUTES` | `60` | Time window in minutes for all summary queries |
| `MIN_REGIONS_FOR_TOP10` | `2` | Minimum regions an endpoint must be tested in to appear in the "Top 15" list |

---
*(The rest of the documentation for Testing, Deployment, etc., remains the same as it is still accurate.)*
---
<details>
<summary>Original Full Documentation (for reference)</summary>

### API Endpoints (Legacy Detail)

#### 1. Health Check (Public)
`GET /health`
Returns server uptime and status.

#### 2. Upload Latency Data (Protected)
`POST /api/upload-latency`
Accepts a specific JSON payload format for latency data. Requires `X-API-KEY`.

#### 3. Upload Monitoring (Protected)
`POST /api/upload-monitoring?region=<region>`
A convenience endpoint that accepts the direct output from the `monitor_endpoints.sh` script. Requires `X-API-KEY`.

#### 4. Get Endpoint Details (Public)
`GET /api/latency/endpoint/:url`
Returns detailed historical performance for a single endpoint URL.

### Database Schema (Legacy Detail)

**Table: `endpoints`**
Stores unique endpoint URLs and their metadata.
`id, chain, kind, url, is_archival, created_at, updated_at`

**Table: `latency_runs`**
Stores the result of each individual test run.
`id, endpoint_id, region, ts, reachable, timeout, latest_height, block1_status, latency_ms, error, http_status`

</details>
