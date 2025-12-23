#!/usr/bin/env bash
#
# upload_sample_latency.sh
#
# Uploads dynamically generated sample latency data to the backend API.
# It checks for and installs necessary dependencies (curl, jq).
#
# USAGE:
#   ./upload_sample_latency.sh <YOUR_API_KEY>
#
# Arguments:
#   <YOUR_API_KEY>: The secret API key for your backend's /api/upload-latency endpoint.
#

set -euo pipefail

# --- ANSI color codes ---
COLOR_BLUE="\033[0;34m"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_RESET="\033[0m"

# --- Prerequisite Check & Auto-Installation ---
check_and_add_dep() {
    local cmd="$1"
    local pkg="$2"
    if ! command -v "$cmd" &>/dev/null; then
        if [[ ! " ${missing_pkgs[*]} " =~ " ${pkg} " ]]; then
            missing_pkgs+=("$pkg")
        fi
    fi
}

install_dependencies() {
    if [ ${#missing_pkgs[@]} -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ All necessary dependencies are satisfied.${COLOR_RESET}"
        return
    fi
    echo -e "${COLOR_BLUE}ℹ️ Some dependencies are missing: ${missing_pkgs[*]}${COLOR_RESET}"
    local manager=""
    local sudo_cmd="sudo"
    if command -v apt-get &>/dev/null; then manager="apt-get";
    elif command -v dnf &>/dev/null; then manager="dnf";
    elif command -v yum &>/dev/null; then manager="yum";
    elif command -v pacman &>/dev/null; then manager="pacman";
    elif command -v brew &>/dev/null; then manager="brew";
    else
        echo -e "${COLOR_RED}❌ Unsupported package manager. Please install manually: ${missing_pkgs[*]}${COLOR_RESET}" >&2
        exit 1
    fi
    if [[ $EUID -eq 0 ]]; then sudo_cmd="";
    elif ! command -v sudo &>/dev/null; then
         echo -e "${COLOR_RED}❌ This script is not running as root and 'sudo' is not available. Please install dependencies manually or run as root.${COLOR_RESET}" >&2
         exit 1
    fi
    echo "Attempting to install with ${manager}..."
    if [ "$manager" = "pacman" ]; then
        $sudo_cmd $manager -S --noconfirm "${missing_pkgs[@]}"
    else
        $sudo_cmd $manager install -y "${missing_pkgs[@]}"
    fi
    echo -e "${COLOR_GREEN}✅ Dependencies should now be installed.${COLOR_RESET}"
}

missing_pkgs=()
check_and_add_dep "curl" "curl"
check_and_add_dep "jq" "jq"
install_dependencies

# --- Script Configuration & Argument Parsing ---
BACKEND_URL="https://celestia-latency-backend.onrender.com"
UPLOAD_ENDPOINT="/api/upload-latency"
FULL_API_URL="${BACKEND_URL}${UPLOAD_ENDPOINT}"

API_KEY=""
if [ -z "${1:-}" ]; then
    echo -e "${COLOR_RED}❌ Error: API Key not provided.${COLOR_RESET}" >&2
    echo "Usage: $0 <YOUR_API_KEY>" >&2
    exit 1
else
    API_KEY="$1"
fi

# --- Dynamic JSON Payload Generation ---
echo -e "${COLOR_BLUE}🔧 Generating dynamic JSON payload...${COLOR_RESET}"
REGION_NAME="test-region-$(date +%s)" # Unique region name for each run
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

JSON_PAYLOAD=$(jq -n \
    --arg region "$REGION_NAME" \
    --arg timestamp "$TIMESTAMP" \
    '{ 
      "region": $region,
      "timestamp": $timestamp,
      "endpoints": [
        {
          "type": "rpc",
          "endpoint": "celestia-rpc.publicnode.com:443",
          "reachable": true, "timeout": false, "error": "", "http_status": "200",
          "latest_height": "2100500", "block1_status": "-", "latency_ms": 52, "chain": "celestia"
        },
        {
          "type": "grpc",
          "endpoint": "celestia-grpc.publicnode.com:443",
          "reachable": true, "timeout": false, "error": "", "http_status": "-",
          "latest_height": "-", "block1_status": "Has block 1", "latency_ms": 87, "chain": "celestia"
        },
        {
          "type": "rpc",
          "endpoint": "celestia-rpc.bad-actor.net:443",
          "reachable": false, "timeout": true, "error": "Connection timed out", "http_status": "-",
          "latest_height": "-", "block1_status": "-", "latency_ms": 7001, "chain": "celestia"
        }
      ]
    }')

echo -e "${COLOR_BLUE}🚀 Uploading sample latency data to ${FULL_API_URL}${COLOR_RESET}"
echo -e "${COLOR_BLUE}Using API Key: [HIDDEN]${COLOR_RESET}"

# --- Execute cURL Command ---
response=$(curl --fail-with-body -sS -X POST "${FULL_API_URL}" \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: ${API_KEY}" \
  -d "$JSON_PAYLOAD")

# --- Check Response ---
if [ $? -eq 0 ]; then
    echo -e "\n${COLOR_GREEN}✅ Upload successful! Server response:${COLOR_RESET}"
    echo "$response" | jq .
else
    echo -e "\n${COLOR_RED}❌ Upload failed.${COLOR_RESET}" >&2
    echo "Server response:" >&2
    # Try to pretty-print JSON if possible, otherwise print raw response
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo "$response" | jq .
    else
        echo "$response"
    fi
    exit 1
fi