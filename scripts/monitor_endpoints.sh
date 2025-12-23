#!/usr/bin/env bash
#
# monitor_endpoints.sh
#
# Celestia RPC/gRPC endpoint monitor:
#  - Fetches RPC & gRPC endpoints from the Cosmos chain registry
#  - Merges in manually specified endpoints (arrays + optional text files)
#  - Tests reachability, timeouts, height, archival depth (block 1)
#  - Measures latency (ms) for calls
#  - Produces plain but nicely aligned terminal tables for gRPC and RPC
#  - Saves structured results to JSON and CSV for further processing
#  - Prints a summary (totals + top 3 fastest gRPC endpoints)
#
# Requirements: bash, curl, jq, grpcurl, timeout (coreutils), date with %3N support
#
# Usage:
#   chmod +x monitor_endpoints.sh
#   ./monitor_endpoints.sh
#
# Optional env vars:
#   REGISTRY_URL     - chain-registry URL (default Celestia mainnet)
#   CHAIN_NAME       - label in the Chain column (default: celestia)
#   JSON_OUT         - JSON results file (default: endpoint_results.json)
#   CSV_OUT          - CSV results file (default: endpoint_results.csv)
#   MANUAL_GRPC_FILE - file with extra gRPC endpoints (default: celestia_grpc_manual.txt)
#   MANUAL_RPC_FILE  - file with extra RPC endpoints (default: celestia_rpc_manual.txt)
#

set -euo pipefail

# Determine script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$SCRIPT_DIR/data"

REGISTRY_URL="${REGISTRY_URL:-https://raw.githubusercontent.com/cosmos/chain-registry/master/celestia/chain.json}"
CHAIN_NAME="${CHAIN_NAME:-celestia}"
JSON_OUT="${JSON_OUT:-$SCRIPT_DIR/endpoint_results.json}"
CSV_OUT="${CSV_OUT:-$SCRIPT_DIR/endpoint_results.csv}"
MANUAL_GRPC_FILE="${MANUAL_GRPC_FILE:-$DATA_DIR/celestia_grpc_manual.txt}"
MANUAL_RPC_FILE="${MANUAL_RPC_FILE:-$DATA_DIR/celestia_rpc_manual.txt}"

# ---------------------------------------------------------------------------
# NO MORE HARDCODED DEFAULTS - Use files instead!
# All manual endpoints should be in:
#   - scripts/data/celestia_grpc_manual.txt
#   - scripts/data/celestia_rpc_manual.txt
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Utility: check required binaries
# ---------------------------------------------------------------------------

need_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required binary '$1' not found in PATH" >&2
    exit 1
  fi
}

need_bin curl
need_bin jq
need_bin grpcurl
need_bin timeout

CHECK_OK="✔"
CHECK_FAIL="✖"
CIRCLE_OK="●"
CIRCLE_EMPTY="○"

# ANSI color codes
COLOR_ORANGE="\033[38;5;208m"
COLOR_GREEN="\033[38;5;46m"
COLOR_RESET="\033[0m"

hr() {
  printf '%s\n' "======================================================================================================"
}

short_ep() {
  # Strip schemes & trailing slashes for nicer printing
  local ep="$1"
  ep="${ep#grpc://}"
  ep="${ep#http://}"
  ep="${ep#https://}"
  ep="${ep%/}"
  
  # Ensure port is present for gRPC endpoints
  if [[ "$ep" != *:* ]]; then
    ep="${ep}:443"
  fi
  
  echo "$ep"
}

now_ms() {
  date +%s%3N
}

ms_diff() {
  local start="$1"; local end="$2"
  echo $((end - start))
}

# ---------------------------------------------------------------------------
# Results collection (for JSON/CSV)
# ---------------------------------------------------------------------------

results=()  # array of JSON objects as strings

grpc_online=0
grpc_archival=0
rpc_online=0
grpc_latency_list=()  # entries like "latency_ms endpoint"

init_csv() {
  echo "type,endpoint,reachable,timeout,error,http_status,latest_height,block1_status,latency_ms,chain" > "$CSV_OUT"
}

add_result() {
  local type="$1"
  local endpoint="$2"
  local reachable="$3"
  local timeout_flag="$4"
  local error_msg="$5"
  local http_status="$6"
  local latest_height="$7"
  local block1_status="$8"
  local latency_ms="$9"

  local reachable_bool
  if [ "$reachable" = "Yes" ]; then
    reachable_bool="true"
  else
    reachable_bool="false"
  fi

  # track summary
  if [ "$type" = "grpc" ] && [ "$reachable" = "Yes" ]; then
    grpc_online=$((grpc_online + 1))
    if [ "$block1_status" = "Has block 1" ]; then
      grpc_archival=$((grpc_archival + 1))
    fi
    if [ "$latency_ms" -ge 0 ]; then
      grpc_latency_list+=("${latency_ms} ${endpoint}")
    fi
  fi

  if [ "$type" = "rpc" ] && [ "$reachable" = "Yes" ]; then
    rpc_online=$((rpc_online + 1))
  fi

  # CLEAN error messages: remove newlines, quotes, and control characters
  error_msg=$(echo "$error_msg" | tr '\n\r' ' ' | tr -d '\000-\011\013-\037' | sed 's/"/'"'"'/g' | sed 's/  */ /g')
  
  # Truncate very long error messages
  if [ ${#error_msg} -gt 200 ]; then
    error_msg="${error_msg:0:200}..."
  fi

  # Build JSON using jq for proper escaping
  local json
  json=$(jq -n \
    --arg type "$type" \
    --arg endpoint "$endpoint" \
    --argjson reachable "$reachable_bool" \
    --argjson timeout "$timeout_flag" \
    --arg error "$error_msg" \
    --arg http_status "$http_status" \
    --arg latest_height "$latest_height" \
    --arg block1_status "$block1_status" \
    --argjson latency_ms "$latency_ms" \
    --arg chain "$CHAIN_NAME" \
    '{
      type: $type,
      endpoint: $endpoint,
      reachable: $reachable,
      timeout: $timeout,
      error: $error,
      http_status: $http_status,
      latest_height: $latest_height,
      block1_status: $block1_status,
      latency_ms: $latency_ms,
      chain: $chain
    }')

  results+=("$json")

  # CSV row (properly escaped)
  printf '%s,"%s",%s,%s,"%s","%s","%s","%s",%s,"%s"\n' \
    "$type" "$endpoint" "$reachable_bool" "$timeout_flag" "${error_msg//\"/\"\"}" "$http_status" "$latest_height" "$block1_status" "$latency_ms" "$CHAIN_NAME" \
    >> "$CSV_OUT"
}

write_json() {
  : > "$JSON_OUT"
  echo "[" >> "$JSON_OUT"
  local i
  for i in "${!results[@]}"; do
    local sep=","
    if [ "$i" -eq $(( ${#results[@]} - 1 )) ]; then
      sep=""
    fi
    printf "  %s%s\n" "${results[$i]}" "$sep" >> "$JSON_OUT"
  done
  echo "]" >> "$JSON_OUT"
}

print_summary() {
  echo
  echo "Summary"
  hr
  echo "Total gRPC endpoints tested : ${#all_grpc[@]}"
  echo "Total RPC  endpoints tested : ${#all_rpc[@]}"
  echo "gRPC online                 : ${grpc_online}"
  echo "gRPC archival (block 1)     : ${grpc_archival}"
  echo "RPC online                  : ${rpc_online}"
  echo

  if [ "${#grpc_latency_list[@]}" -gt 0 ]; then
    echo "Top 3 fastest reachable gRPC endpoints (by latency):"
    printf '%s\n' "${grpc_latency_list[@]}" | sort -n | head -n 3 | while read -r line; do
      local lat ep
      lat="${line%% *}"
      ep="${line#* }"
      echo "  - ${ep} (${lat} ms)"
    done
  else
    echo "No reachable gRPC endpoints to build latency ranking."
  fi
}

# ---------------------------------------------------------------------------
# Read manual endpoints from text files (one endpoint per line, # comments)
# ---------------------------------------------------------------------------

read_manual_file() {
  local file="$1"
  if [ -f "$file" ]; then
    sed 's/#.*$//' "$file" | sed '/^[[:space:]]*$/d'
  fi
}

# ---------------------------------------------------------------------------
# Fetch endpoints from chain registry
# ---------------------------------------------------------------------------

echo "Fetching endpoints from chain registry..."
echo "Manual gRPC file: $MANUAL_GRPC_FILE"
echo "Manual RPC file: $MANUAL_RPC_FILE"
registry_json=$(curl -fsSL "$REGISTRY_URL")

mapfile -t registry_grpc < <(echo "$registry_json" | jq -r '.apis.grpc[]?.address' 2>/dev/null | sed 's|^grpc://||' | awk -F: '{if (NF==1) print $0":443"; else print $0}' || true)
mapfile -t registry_rpc  < <(echo "$registry_json" | jq -r '.apis.rpc[]?.address'  2>/dev/null || true)

echo "Found ${#registry_grpc[@]} gRPC endpoints and ${#registry_rpc[@]} RPC endpoints in registry."

# manual from files
echo "Reading manual files..."
mapfile -t manual_grpc_file < <(read_manual_file "$MANUAL_GRPC_FILE" || true)
mapfile -t manual_rpc_file  < <(read_manual_file "$MANUAL_RPC_FILE" || true)

echo "Found ${#manual_grpc_file[@]} manual gRPC endpoints and ${#manual_rpc_file[@]} manual RPC endpoints in files."

# merge + dedupe (NO MORE DEFAULTS ARRAY)
all_grpc=("${registry_grpc[@]}" "${manual_grpc_file[@]}")
all_rpc=("${registry_rpc[@]}" "${manual_rpc_file[@]}")

mapfile -t all_grpc < <(printf '%s\n' "${all_grpc[@]}" | sed '/^$/d' | sort -u)
mapfile -t all_rpc  < <(printf '%s\n' "${all_rpc[@]}"  | sed '/^$/d' | sort -u)

echo "Total unique gRPC endpoints (registry + manual): ${#all_grpc[@]}"
echo "Total unique RPC  endpoints (registry + manual): ${#all_rpc[@]}"
echo

# ---------------------------------------------------------------------------
# Pretty gRPC table
# ---------------------------------------------------------------------------

init_csv

echo "gRPC Endpoint Block 1 Check - $(date -u +"%a %b %d %T %Z %Y")"
hr
printf "%-55s | %-10s | %-22s | %-8s | %-10s\n" "Endpoint" "Reachable" "Block 1 Status" "Chain" "Latency"
hr

check_grpc() {
  local raw_ep="$1"
  
  # Normalize endpoint: remove scheme, ensure port
  raw_ep="${raw_ep#grpc://}"
  if [[ "$raw_ep" != *:* ]]; then
    raw_ep="${raw_ep}:443"
  fi
  
  local ep; ep=$(short_ep "$raw_ep")

  local flags=""
  # assume TLS for :443, plaintext otherwise
  if [[ "$ep" == *:443 ]]; then
    flags=""
  else
    flags="-plaintext"
  fi

  local reachable="No"
  local block1="Unreachable"
  local timeout_flag="false"
  local err=""
  local latency_ms="-1"

  local start end
  start=$(now_ms)
  if out=$(timeout 7s grpcurl $flags "$ep" cosmos.base.tendermint.v1beta1.Service/GetLatestBlock 2>&1); then
    end=$(now_ms)
    latency_ms=$(ms_diff "$start" "$end")
    reachable="Yes"
    block1="Pruned / No block 1"

    # Try to fetch block 1 - using GetBlockByHeight which works for Celestia
    if timeout 10s grpcurl $flags -d '{"height":"1"}' \
        "$ep" cosmos.base.tendermint.v1beta1.Service/GetBlockByHeight >/dev/null 2>&1; then
      block1="Has block 1"
    fi
  else
    local rc=$?
    end=$(now_ms)
    latency_ms=$(ms_diff "$start" "$end")
    err="$out"
    if [ "$rc" -eq 124 ]; then
      timeout_flag="true"
      block1="Timeout"
    else
      block1="Unreachable"
    fi
  fi

  local reach_disp block_disp
  if [ "$reachable" = "Yes" ]; then
    reach_disp="$CHECK_OK Yes"
  else
    reach_disp="$CHECK_FAIL No"
  fi

  case "$block1" in
    "Has block 1")
      block_disp="$CIRCLE_OK Has block 1"
      ;;
    "Pruned / No block 1")
      block_disp="$CIRCLE_EMPTY Pruned / No block 1"
      ;;
    "Timeout")
      block_disp="$CHECK_FAIL Timeout"
      ;;
    *)
      block_disp="$CHECK_FAIL Unreachable"
      ;;
  esac

  # Highlight validatus endpoints in orange, online endpoints in green
  if [[ "$ep" == *"validatus"* ]]; then
    printf "${COLOR_ORANGE}%-55s | %-12s | %-24s | %-8s | %-10s${COLOR_RESET}\n" \
      "$ep" "$reach_disp" "$block_disp" "$CHAIN_NAME" "${latency_ms}ms"
  elif [[ "$reachable" == "Yes" ]]; then
    printf "${COLOR_GREEN}%-55s | %-12s | %-24s | %-8s | %-10s${COLOR_RESET}\n" \
      "$ep" "$reach_disp" "$block_disp" "$CHAIN_NAME" "${latency_ms}ms"
  else
    printf "%-55s | %-12s | %-24s | %-8s | %-10s\n" \
      "$ep" "$reach_disp" "$block_disp" "$CHAIN_NAME" "${latency_ms}ms"
  fi

  add_result "grpc" "$ep" "$reachable" "$timeout_flag" "$err" "-" "-" "$block1" "$latency_ms"
}

for ep in "${all_grpc[@]}"; do
  check_grpc "$ep"
done
hr
echo

# ---------------------------------------------------------------------------
# Pretty RPC table
# ---------------------------------------------------------------------------

echo "RPC HTTP Health Check - $(date -u +"%a %b %d %T %Z %Y")"
hr
printf "%-55s | %-10s | %-22s | %-8s | %-10s\n" "Endpoint" "Reachable" "Latest Block" "Chain" "Latency"
hr

check_rpc() {
  local raw_ep="$1"
  
  # Remove scheme for display
  local ep="${raw_ep#http://}"
  ep="${ep#https://}"
  ep="${ep%/}"

  # ensure scheme for curl
  local url="$raw_ep"
  if [[ "$url" != http*://* ]]; then
    url="https://$url"
  fi

  local reachable="No"
  local timeout_flag="false"
  local err=""
  local latest="-"
  local http_status="-"
  local latency_ms="-1"

  local start end
  start=$(now_ms)
  if resp=$(timeout 7s curl -fsS --max-time 6 -w ' HTTPSTATUS:%{http_code}' "$url/status" 2>&1); then
    end=$(now_ms)
    latency_ms=$(ms_diff "$start" "$end")
    http_status=$(echo "$resp" | sed -n 's/.*HTTPSTATUS://p')
    local body
    body=$(echo "$resp" | sed 's/ HTTPSTATUS:.*//')
    reachable="Yes"
    latest=$(echo "$body" | jq -r '.result.sync_info.latest_block_height' 2>/dev/null || echo "-")
  else
    local rc=$?
    end=$(now_ms)
    latency_ms=$(ms_diff "$start" "$end")
    err="$resp"
    if [ "$rc" -eq 124 ]; then
      timeout_flag="true"
    fi
  fi

  local reach_disp
  if [ "$reachable" = "Yes" ]; then
    reach_disp="$CHECK_OK Yes"
  else
    reach_disp="$CHECK_FAIL No"
  fi

  # Highlight validatus endpoints in orange, online endpoints in green
  if [[ "$ep" == *"validatus"* ]]; then
    printf "${COLOR_ORANGE}%-55s | %-12s | %-18s | %-8s | %-10s${COLOR_RESET}\n" \
      "$ep" "$reach_disp" "$latest" "$CHAIN_NAME" "${latency_ms}ms"
  elif [[ "$reachable" == "Yes" ]]; then
    printf "${COLOR_GREEN}%-55s | %-12s | %-18s | %-8s | %-10s${COLOR_RESET}\n" \
      "$ep" "$reach_disp" "$latest" "$CHAIN_NAME" "${latency_ms}ms"
  else
    printf "%-55s | %-12s | %-18s | %-8s | %-10s\n" \
      "$ep" "$reach_disp" "$latest" "$CHAIN_NAME" "${latency_ms}ms"
  fi

  add_result "rpc" "$ep" "$reachable" "$timeout_flag" "$err" "$http_status" "$latest" "-" "$latency_ms"
}

for ep in "${all_rpc[@]}"; do
  check_rpc "$ep"
done
hr

write_json
print_summary

echo
echo "Results written to: $JSON_OUT, $CSV_OUT"

# Optional: Upload results to Cloudflare Worker
if [ -n "${WORKER_UPLOAD_URL:-}" ]; then
  echo
  echo "Uploading results to Worker..."
  if curl -X POST -H "Content-Type: application/json" -d @"$JSON_OUT" "$WORKER_UPLOAD_URL/api/upload-monitoring" 2>/dev/null; then
    echo "✓ Upload successful"
  else
    echo "✗ Upload failed (check WORKER_UPLOAD_URL)"
  fi
fi
