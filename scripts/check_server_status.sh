#!/usr/bin/env bash
#
# check_server_status.sh
#
# A simple script to list all Hetzner Cloud servers in a project
# using curl and jq. It displays their status and other key attributes
# in a table, and provides a summary of online/offline counts.
#
# Depends on: curl, jq, column
#

# Exit immediately if a command exits with a non-zero status.
set -euo pipefail

# --- Configuration ---
# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate that the Hetzner API token is available
if [ -z "${HETZNER_API_TOKEN:-}" ]; then
  echo "❌ Error: Environment variable 'HETZNER_API_TOKEN' is not set. Please define it in '.env'." >&2
  exit 1
fi

echo "🔍 Fetching server statuses from Hetzner Cloud via cURL..."

# --- Main Logic ---

# Fetch the full server list in JSON format using curl
# The -s flag makes curl silent (no progress meter)
server_list_json=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" "https://api.hetzner.cloud/v1/servers")

# Check if the API returned an error
if echo "$server_list_json" | jq -e '.error' > /dev/null; then
  echo "❌ API Error received from Hetzner:"
  echo "$server_list_json" | jq '.error'
  exit 1
fi

# Calculate online/offline counts using jq
total_count=$(echo "$server_list_json" | jq '.servers | length')
online_count=$(echo "$server_list_json" | jq '[.servers[] | select(.status == "running")] | length')
offline_count=$(echo "$server_list_json" | jq '[.servers[] | select(.status == "off")] | length')

# --- Output ---

echo "=========================================="
echo "📊 Server Status Summary"
echo "=========================================="
echo "Total Servers: $total_count"
echo "  - ✅ Online:  $online_count"
echo "  - 🔌 Offline: $offline_count"
echo "=========================================="
echo

# Display the detailed table of all servers, formatted by jq and column
echo "📋 Detailed Server List:"
echo "$server_list_json" | jq -r '
  ["ID", "Name", "Status", "IPv4", "Location", "Type"],
  (.servers[] | [
    .id,
    .name,
    .status,
    .public_net.ipv4.ip,
    .datacenter.location.name,
    .server_type.name
  ])
  | @tsv
' | column -t -s $'\t'

echo
echo "🎉 Status check complete."

