#!/usr/bin/env bash

# ==============================================================================
# setup_and_run_remote.sh
#
# USAGE:
#   ./setup_and_run_remote.sh <REGION> <BACKEND_API_KEY>
#
# This script is designed to be run on a remote Hetzner server.
# It fully prepares the server by installing dependencies, cloning or updating
# the monitor script repository, and then executes the monitor script with the
# correct configuration.
#
# ARGUMENTS:
#   <REGION>: The region name for this server (e.g., "ash", "nbg1").
#   <BACKEND_API_KEY>: The secret API key for your backend.
# ==============================================================================

set -euo pipefail

# --- 1. Argument Validation ---
if [ "$#" -ne 2 ]; then
    echo "❌ Error: Invalid number of arguments."
    echo "Usage: $0 <REGION> <BACKEND_API_KEY>"
    exit 1
fi

# --- 2. Configuration from Arguments & Environment ---
REGION="$1"
BACKEND_API_KEY="$2"
GIT_REPO_URL="https://github.com/proximom/monitor-endpoints-sh.git"
REMOTE_PROJECT_PATH="/root/app"
BACKEND_API_URL="https://celestia-latency-backend.onrender.com/api/upload-monitoring"

echo "🚀 Starting remote server setup and execution for region: ${REGION}..."

# --- 3. Main Execution ---

# Function to install all dependencies
install_dependencies() {
    echo "📦 Updating package list and installing dependencies..."
    
    # ✅ FIX: Detect the package manager and use the correct command.
    if command -v apt-get &> /dev/null; then
        echo "  -> Found apt-get (Debian/Ubuntu). Installing..."
        apt-get update > /dev/null
        apt-get install -y git curl jq wget tar > /dev/null
    elif command -v dnf &> /dev/null; then
        echo "  -> Found dnf (RHEL/Rocky/Fedora). Installing..."
        dnf install -y git curl jq wget tar > /dev/null
    elif command -v yum &> /dev/null; then
        echo "  -> Found yum (CentOS/RHEL). Installing..."
        yum install -y git curl jq wget tar > /dev/null
    else
        echo "❌ Error: Could not find a known package manager (apt-get, dnf, yum)." >&2
        exit 1
    fi
    
    echo "📦 Installing grpcurl manually (universal method)..."
    GRPCURL_VERSION="1.8.9"
    wget -q https://github.com/fullstorydev/grpcurl/releases/download/v${GRPCURL_VERSION}/grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz
    tar -xzf grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz
    mv grpcurl /usr/local/bin/
    chmod +x /usr/local/bin/grpcurl
    rm grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz
    echo "✅ Dependencies ready."
}

# Check if dependencies are installed, if not, install them
if ! command -v git &> /dev/null || ! command -v curl &> /dev/null || ! command -v jq &> /dev/null || ! command -v grpcurl &> /dev/null; then
    install_dependencies
else
    echo "✅ Dependencies already installed."
fi

# Clone the repo if it doesn't exist, or pull the latest changes if it does
echo "🔄 Checking repository at ${REMOTE_PROJECT_PATH}..."

# ✅ FIX: Check for the .git directory to see if it's a real git repo.
if [ ! -d "${REMOTE_PROJECT_PATH}/.git" ]; then
    echo "  -> Git repository not found. Cleaning up and cloning fresh..."
    # Remove the directory if it exists but isn't a valid git repo
    rm -rf "${REMOTE_PROJECT_PATH}"
    git clone "${GIT_REPO_URL}" "${REMOTE_PROJECT_PATH}"
else
    echo "  -> Repository found. Pulling latest changes..."
    cd "${REMOTE_PROJECT_PATH}"
    git pull
fi

cd "${REMOTE_PROJECT_PATH}"

# ✅ FIX: Add executable permission to the script after cloning/pulling.
echo "🔧 Setting execute permissions for monitor_endpoints.sh..."
chmod +x monitor_endpoints.sh

echo "🔧 Applying patch to monitor_endpoints.sh for verbose upload..."
# Replace the old, silent upload block with a new, verbose one.
sed -i '/# Optional: Upload results to Cloudflare Worker/,$d' ./monitor_endpoints.sh
cat << 'EOF' >> ./monitor_endpoints.sh

# Upload results to your backend
if [ -n "${BACKEND_API_URL:-}" ]; then
  echo
  echo "Uploading results to backend from region: ${REGION}..."
  echo "Target URL: ${BACKEND_API_URL}?region=${REGION}"
  
  # Use curl with verbose output (-v) to debug connection issues.
  curl -v -X POST \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: ${API_KEY}" \
    -d "@${JSON_OUT}" \
    "${BACKEND_API_URL}?region=${REGION}"

  if [ $? -eq 0 ]; then
    echo "✅ cURL command executed. Check logs above for API response."
  else
    echo "❌ cURL command failed to execute. This often indicates a network or DNS issue." >&2
    exit 1
  fi
fi
EOF

echo "✅ Ready to run monitor script."

# Export environment variables for the monitor script to use
export BACKEND_API_URL
export API_KEY="$BACKEND_API_KEY"
export REGION

# Execute the monitor script
echo "🧪 Running monitor_endpoints.sh..."
if ./monitor_endpoints.sh; then
    echo "🎉 Script finished successfully."
else
    echo "❌ Script failed. Check the output above for errors."
fi
