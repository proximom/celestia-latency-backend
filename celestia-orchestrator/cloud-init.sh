#!/bin/bash

# This script runs automatically on new Hetzner servers.
# It sets up the environment, runs the monitor script, and self-destructs.

# Log all output for debugging
exec > /root/cloud-init-output.log 2>&1

echo "=========================================="
echo "Server boot at $(date)"
echo "=========================================="

# 1. Install dependencies with retry
echo "📦 Installing dependencies..."
for i in {1..3}; do
  if apt-get update && apt-get install -y git curl jq wget; then
    echo "✅ apt packages installed"
    break
  fi
  echo "⚠️  apt-get failed, retrying in 10 seconds... (attempt $i/3)"
  sleep 10
done

# 2. Install grpcurl manually
echo "📦 Installing grpcurl..."
GRPCURL_VERSION="1.8.9"
wget -q https://github.com/fullstorydev/grpcurl/releases/download/v${GRPCURL_VERSION}/grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz
if tar -xzf grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz && \
   mv grpcurl /usr/local/bin/ && \
   chmod +x /usr/local/bin/grpcurl; then
  echo "✅ grpcurl installed"
  rm grpcurl_${GRPCURL_VERSION}_linux_x86_64.tar.gz
else
  echo "❌ Failed to install grpcurl"
  exit 1
fi

# 3. Verify installations
echo "🔍 Verifying installations..."
curl --version | head -n1
jq --version
grpcurl --version

# 4. Clone the Git repository
echo "📥 Cloning repository..."
if git clone "__GIT_REPO_URL__" /root/app; then
  echo "✅ Repository cloned"
  cd /root/app
else
  echo "❌ Failed to clone repository"
  exit 1
fi

# 5. Create required directories
mkdir -p scripts/data

# 6. Run the monitor script
echo "=========================================="
echo "🧪 Running monitor_endpoints.sh"
echo "=========================================="

export BACKEND_URL="__BACKEND_API_URL__"
export API_KEY="__BACKEND_API_KEY__"
export REGION="__REGION__"
export WORKER_UPLOAD_URL="__BACKEND_API_URL__"

if ./monitor_endpoints.sh; then
  echo "✅ Monitor script completed successfully"
else
  echo "❌ Monitor script failed with exit code $?"
fi

# 7. Self-Destruct
echo "=========================================="
echo "💣 Initiating self-destruct sequence"
echo "=========================================="

# Get server ID with retry
for i in {1..5}; do
  SERVER_ID=$(curl -s http://169.254.169.254/hetzner/v1/metadata/instance-id)
  if [ -n "$SERVER_ID" ]; then
    echo "✅ Server ID retrieved: $SERVER_ID"
    break
  fi
  echo "⚠️  Waiting for metadata service... ($i/5)"
  sleep 5
done

if [ -z "$SERVER_ID" ]; then
  echo "❌ Could not retrieve server ID after 5 attempts"
  echo "🔌 Shutting down to minimize costs..."
  shutdown -h now
  exit 1
fi

# Delete this server via API
echo "🗑️  Issuing delete command for server $SERVER_ID..."
DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE \
  -H "Authorization: Bearer __HETZNER_API_TOKEN__" \
  "https://api.hetzner.cloud/v1/servers/$SERVER_ID")

HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
  echo "✅ Self-destruct successful (HTTP $HTTP_STATUS)"
else
  echo "❌ Self-destruct may have failed (HTTP $HTTP_STATUS)"
  echo "Response: $DELETE_RESPONSE"
  # Force shutdown anyway
  shutdown -h now
fi

echo "=========================================="
echo "Script completed at $(date)"
echo "=========================================="