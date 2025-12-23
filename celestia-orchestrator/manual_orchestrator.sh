#!/usr/bin/env bash
#
# manual_orchestrator.sh
#
# Automates the "power on -> ssh -> run test -> power off" workflow
# for a predefined list of existing Hetzner Cloud servers.
# It uses the `hcloud` CLI and runs tests for all servers in parallel.
#

# Exit immediately if a command exits with a non-zero status.
set -euo pipefail

# --- Configuration ---
# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate required environment variables
REQUIRED_VARS=(
  "HETZNER_API_TOKEN"
  "BACKEND_API_URL"
  "BACKEND_API_KEY"
  "HETZNER_SSH_PRIVATE_KEY_PATH"
  "REMOTE_PROJECT_PATH"
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "❌ Error: Environment variable '$var' is not set. Please define it in '.env'." >&2
    exit 1
  fi
done

# Define the list of servers and their corresponding regions
# This maps the server name in Hetzner to the region name for the monitor script.
declare -A SERVERS=(
  ["rocky-ash-1"]="ash"
  ["rocky-hil-1"]="us-west"
  ["rocky-nbg1-1"]="nbg1"
  ["rocky-hel1-3"]="hel1"
  ["rocky-sin-1"]="sin1"
)

# --- Main Logic ---

# This function defines the full lifecycle for a single server
run_test_on_server() {
  local server_name="$1"
  local region="$2"
  
  echo "▶️ Starting process for server: $server_name in region $region"

  # 1. Power ON the server (if it's not already on)
  echo "  - Powering ON server: $server_name..."
  hcloud server poweron "$server_name"

  # 2. Wait for the server to be running and get its IP
  echo "  - Waiting for server to become available..."
  local server_ip
  while true; do
    server_ip=$(hcloud server ip "$server_name")
    if [ -n "$server_ip" ]; then
      # Test SSH connection
      if ssh -o "StrictHostKeyChecking=no" -o "ConnectTimeout=5" -i "$HETZNER_SSH_PRIVATE_KEY_PATH" "root@$server_ip" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        echo "  - ✅ Server is online with IP: $server_ip"
        break
      fi
    fi
    sleep 5
  done

  # 3. Execute the remote monitoring script via SSH
  echo "  - Executing remote monitor script on $server_name..."
  # The remote command is wrapped in 'bash -c' to properly handle variable exports.
  ssh -o "StrictHostKeyChecking=no" -i "$HETZNER_SSH_PRIVATE_KEY_PATH" "root@$server_ip" "bash -c '
    export BACKEND_API_URL=\"$BACKEND_API_URL\"
    export API_KEY=\"$BACKEND_API_KEY\"
    export REGION=\"$region\"
    cd \"$REMOTE_PROJECT_PATH\"
    ./monitor_endpoints.sh
  '"

  # 4. Power OFF the server
  echo "  - Powering OFF server: $server_name..."
  hcloud server poweroff "$server_name"
  
  echo "⏹️ Finished process for server: $server_name"
}

# --- Orchestration ---

echo "🚀 Starting Manual Orchestration for ${#SERVERS[@]} servers..."
echo "This will run all tests in parallel."

# Configure hcloud CLI with the API token
echo "Configuring hcloud CLI..."
hcloud context create --token "$HETZNER_API_TOKEN" orchestrator_context >/dev/null 2>&1
hcloud context use orchestrator_context

pids=()
# Loop through all servers and run the test function in the background
for server_name in "${!SERVERS[@]}"; do
  region=${SERVERS[$server_name]}
  # Run the entire process for one server in a background subshell
  ( run_test_on_server "$server_name" "$region" ) &
  pids+=($!)
done

# Wait for all background jobs to complete
echo "⏳ Waiting for all server tests to complete..."
for pid in "${pids[@]}"; do
  wait "$pid"
done

echo "🎉 All tests completed!"
