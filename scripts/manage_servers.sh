#!/usr/bin/env bash
#
# manage_servers.sh
#
# A Bash-based interactive script to manage Hetzner Cloud servers.
# It checks for dependencies and can take the API token as an argument.
#
# USAGE:
#   ./manage_servers.sh [HETZNER_API_TOKEN]
#
# If the token is not provided as an argument, it will be sourced
# from an environment variable or a .env file.
#

set -euo pipefail

# --- Prerequisite Check & Auto-Installation ---

# Function to check for a command and add its package to a list if missing
check_and_add_dep() {
    local cmd="$1"
    local pkg="$2"
    
    if ! command -v "$cmd" &>/dev/null;
 then
        # Check if the package is already in the list to avoid duplicates
        if [[ ! " ${missing_pkgs[*]} " =~ " ${pkg} " ]]; then
            missing_pkgs+=("$pkg")
        fi
    fi
}

# Function to install missing packages
install_dependencies() {
    if [ ${#missing_pkgs[@]} -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ All dependencies are satisfied.${COLOR_RESET}"
        return
    fi

    echo -e "${COLOR_BLUE}ℹ️ Some dependencies are missing. Required packages: ${missing_pkgs[*]}${COLOR_RESET}"
    
    local manager=""
    local sudo_cmd="sudo"
    
    # Detect package manager
    if command -v apt-get &>/dev/null; then manager="apt-get";
    elif command -v dnf &>/dev/null; then manager="dnf";
    elif command -v yum &>/dev/null; then manager="yum";
    elif command -v pacman &>/dev/null; then manager="pacman";
    elif command -v brew &>/dev/null; then manager="brew";
    else
        echo -e "${COLOR_RED}❌ Unsupported package manager. Please install manually: ${missing_pkgs[*]}${COLOR_RESET}" >&2
        exit 1
    fi
    
    # Check if running as root, if so, sudo is not needed
    if [[ $EUID -eq 0 ]]; then
        sudo_cmd=""
    elif ! command -v sudo &>/dev/null; then
         echo -e "${COLOR_RED}❌ This script is not running as root and 'sudo' is not available. Please install dependencies manually or run as root.${COLOR_RESET}" >&2
         exit 1
    fi

    echo "Attempting to install with ${manager}..."
    # Suppress stdout for update, show for install
    $sudo_cmd $manager update > /dev/null
    # For pacman, which requires --noconfirm
    if [ "$manager" = "pacman" ]; then
        $sudo_cmd $manager -S --noconfirm "${missing_pkgs[@]}"
    else
        $sudo_cmd $manager install -y "${missing_pkgs[@]}"
    fi

    echo -e "${COLOR_GREEN}✅ Dependencies should now be installed.${COLOR_RESET}"
}


# --- Configuration & Setup ---

# ANSI color codes
COLOR_BLUE="\033[0;34m"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_RESET="\033[0m"

# Check dependencies first
missing_pkgs=()
check_and_add_dep "curl" "curl"
check_and_add_dep "jq" "jq"
# 'column' is in different packages depending on the OS
if ! command -v column &>/dev/null; then
    if command -v apt-get &> /dev/null; then missing_pkgs+=("bsdmainutils"); 
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then missing_pkgs+=("util-linux"); 
    else missing_pkgs+=("util-linux"); fi # Best guess for others
fi
install_dependencies

# --- Environment Variable Loading ---
HETZNER_API_TOKEN=""

# Priority 1: Command-line argument
if [ -n "${1:-}" ]; then
    echo -e "${COLOR_BLUE}ℹ️ Using API token from command-line argument.${COLOR_RESET}"
    HETZNER_API_TOKEN="$1"
# Priority 2: Environment variable
elif [ -n "${HETZNER_API_TOKEN_ENV:-}" ]; then
    echo -e "${COLOR_BLUE}ℹ️ Using API token from HETZNER_API_TOKEN_ENV environment variable.${COLOR_RESET}"
    HETZNER_API_TOKEN="${HETZNER_API_TOKEN_ENV}"
# Priority 3: .env file
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="${SCRIPT_DIR}/.env"
    if [ -f "$ENV_FILE" ]; then
        echo -e "${COLOR_BLUE}ℹ️ Using API token from .env file.${COLOR_RESET}"
#!/usr/bin/env bash
#
# manage_servers.sh
#
# A Bash-based interactive script to manage Hetzner Cloud servers.
# It checks for dependencies and can take the API token as an argument.
#
# USAGE:
#   ./manage_servers.sh [HETZNER_API_TOKEN]
#
# If the token is not provided as an argument, it will be sourced
# from an environment variable or a .env file.
#

set -euo pipefail

# --- Prerequisite Check & Auto-Installation ---

# ANSI color codes for output
COLOR_BLUE="\033[0;34m"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_RESET="\033[0m"

# Function to check for a command and add its package to a list if missing
check_and_add_dep() {
    local cmd="$1"
    local pkg="$2"
    if ! command -v "$cmd" &>/dev/null; then
        if [[ ! " ${missing_pkgs[*]} " =~ " ${pkg} " ]]; then
            missing_pkgs+=("$pkg")
        fi
    fi
}

# Function to install missing packages
install_dependencies() {
    if [ ${#missing_pkgs[@]} -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ All dependencies are satisfied.${COLOR_RESET}"
        return
    fi

    echo -e "${COLOR_BLUE}ℹ️ Some dependencies are missing. Required packages: ${missing_pkgs[*]}${COLOR_RESET}"
    
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
        # For other managers like apt-get, yum, dnf, brew
        $sudo_cmd $manager install -y "${missing_pkgs[@]}"
    fi
    echo -e "${COLOR_GREEN}✅ Dependencies should now be installed.${COLOR_RESET}"
}

# Check dependencies first
missing_pkgs=()
check_and_add_dep "curl" "curl"
check_and_add_dep "jq" "jq"
if ! command -v column &>/dev/null; then
    if command -v apt-get &> /dev/null; then missing_pkgs+=("bsdmainutils"); 
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then missing_pkgs+=("util-linux"); 
    else missing_pkgs+=("util-linux"); fi
fi
install_dependencies

# --- Environment Variable Loading ---
HETZNER_API_TOKEN=""

# Priority 1: Command-line argument
if [ -n "${1:-}" ]; then
    echo -e "${COLOR_BLUE}ℹ️ Using API token from command-line argument.${COLOR_RESET}"
    HETZNER_API_TOKEN="$1"
# Priority 2: Environment variable
elif [ -n "${HETZNER_API_TOKEN:-}" ]; then
    echo -e "${COLOR_BLUE}ℹ️ Using API token from HETZNER_API_TOKEN environment variable.${COLOR_RESET}"
    HETZNER_API_TOKEN="${HETZNER_API_TOKEN}"
# Priority 3: .env file
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="${SCRIPT_DIR}/.env"
    if [ -f "$ENV_FILE" ]; then
        echo -e "${COLOR_BLUE}ℹ️ Using API token from .env file.${COLOR_RESET}"
        TOKEN_FROM_FILE=$(grep -E '^HETZNER_API_TOKEN=' "$ENV_FILE" | cut -d '=' -f2-)
        # FIX: Use sed for safe quote stripping
        HETZNER_API_TOKEN=$(echo "$TOKEN_FROM_FILE" | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
    fi
fi

if [ -z "$HETZNER_API_TOKEN" ]; then
  echo -e "${COLOR_RED}❌ Error: Hetzner API Token not provided.${COLOR_RESET}" >&2
  echo "   Usage: $0 [YOUR_HETZNER_API_TOKEN]" >&2
  echo "   Alternatively, set it as an environment variable (HETZNER_API_TOKEN) or in a .env file."
  exit 1
fi

BASE_URL="https://api.hetzner.cloud/v1"

# --- Core Functions ---

list_servers() {
    echo -e "\n${COLOR_BLUE}🔍 Fetching server list from Hetzner Cloud...${COLOR_RESET}"
    if ! servers_json=$(curl -sS -H "Authorization: Bearer ${HETZNER_API_TOKEN}" "${BASE_URL}/servers"); then
        echo -e "${COLOR_RED}❌ API call failed. Check your network connection or API token.${COLOR_RESET}" >&2
        return 1
    fi
    echo -e "${COLOR_GREEN}✅ Done.${COLOR_RESET}\n"
    (
        echo -e "ID\tName\tStatus\tIPv4\tLocation"
        echo "$servers_json" | jq -r '.servers[] | [.id, .name, .status, .public_net.ipv4.ip, .datacenter.location.name] | @tsv'
    ) | column -t -s 
}

execute_server_action() {
    local action_name="$1"
    local server_id
    read -p "▶️ Enter the server ID to ${action_name}: " server_id
    if ! [[ "$server_id" =~ ^[0-9]+$ ]]; then
        echo -e "${COLOR_RED}❌ Invalid ID. Please enter a number.${COLOR_RESET}" >&2
        return 1
    fi
    echo -e "  - Sending '${action_name}' command to server ID ${server_id}..."
    response=$(curl -sS -X POST \
        -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
        -H "Content-Type: application/json" \
        "${BASE_URL}/servers/${server_id}/actions/${action_name}")
    if echo "$response" | jq -e '.action.status == "running"' > /dev/null; then
        echo -e "  - ${COLOR_GREEN}✅ Command sent successfully!${COLOR_RESET}"
    else
        error_message=$(echo "$response" | jq -r '.error.message // "Unknown error occurred"')
        echo -e "  - ${COLOR_RED}❌ Failed to send command: ${error_message}${COLOR_RESET}" >&2
    fi
}

# --- Main Menu and Loop ---

display_menu() {
    echo -e "\n--- Hetzner Server Manager (Bash) ---"
    echo "1. List and Refresh Servers"
    echo "2. Power ON a Server"
    echo "3. Power OFF a Server"
    echo "4. Exit"
    read -p "Choose an option: " choice
}

# --- Script Execution ---

echo -e "${COLOR_GREEN}Hetzner Server Manager initialized.${COLOR_RESET}"
list_servers

while true; do
    display_menu
    case "$choice" in
        1) list_servers ;;
        2) execute_server_action "poweron" ;;
        3) execute_server_action "shutdown" ;;
        4) echo -e "\n${COLOR_BLUE}👋 Exiting.${COLOR_RESET}"; break ;;
        *) echo -e "\n${COLOR_RED}❌ Invalid option, please try again.${COLOR_RESET}" ;;
    esac
done
    fi
fi

if [ -z "$HETZNER_API_TOKEN" ]; then
  echo -e "${COLOR_RED}❌ Error: Hetzner API Token not provided.${COLOR_RESET}" >&2
  echo "   Usage: $0 [YOUR_HETZNER_API_TOKEN]" >&2
  echo "   Alternatively, set it as HETZNER_API_TOKEN_ENV environment variable or in a .env file." >&2
  exit 1
fi

BASE_URL="https://api.hetzner.cloud/v1"

# --- Core Functions (Unchanged) ---

list_servers() {
    echo -e "\n${COLOR_BLUE}🔍 Fetching server list from Hetzner Cloud...${COLOR_RESET}"
    if ! servers_json=$(curl -sS -H "Authorization: Bearer ${HETZNER_API_TOKEN}" "${BASE_URL}/servers"); then
        echo -e "${COLOR_RED}❌ API call failed. Check your network connection or API token.${COLOR_RESET}" >&2
        return 1
    fi
    echo -e "${COLOR_GREEN}✅ Done.${COLOR_RESET}\n"
    (
        echo -e "ID\tName\tStatus\tIPv4\tLocation"
        echo "$servers_json" | jq -r '.servers[] | [.id, .name, .status, .public_net.ipv4.ip, .datacenter.location.name] | @tsv'
    ) | column -t -s $'	'
}

execute_server_action() {
    local action_name="$1"
    local server_id
    read -p "▶️ Enter the server ID to ${action_name}: " server_id
    if ! [[ "$server_id" =~ ^[0-9]+$ ]]; then
        echo -e "${COLOR_RED}❌ Invalid ID. Please enter a number.${COLOR_RESET}" >&2
        return 1
    fi
    echo -e "  - Sending '${action_name}' command to server ID ${server_id}..."
    response=$(curl -sS -X POST \
        -H "Authorization: Bearer ${HETZNER_API_TOKEN}" \
        -H "Content-Type: application/json" \
        "${BASE_URL}/servers/${server_id}/actions/${action_name}")
    if echo "$response" | jq -e '.action.status == "running"' > /dev/null; then
        echo -e "  - ${COLOR_GREEN}✅ Command sent successfully!${COLOR_RESET}"
    else
        error_message=$(echo "$response" | jq -r '.error.message // "Unknown error occurred"')
        echo -e "  - ${COLOR_RED}❌ Failed to send command: ${error_message}${COLOR_RESET}" >&2
    fi
}

# --- Main Menu and Loop (Unchanged) ---

display_menu() {
    echo -e "\n--- Hetzner Server Manager (Bash) ---"
    echo "1. List and Refresh Servers"
    echo "2. Power ON a Server"
    echo "3. Power OFF a Server"
    echo "4. Exit"
    read -p "Choose an option: " choice
}

# --- Script Execution ---

echo -e "${COLOR_GREEN}Hetzner Server Manager initialized.${COLOR_RESET}"
list_servers

while true; do
    display_menu
    case "$choice" in
        1) list_servers ;; 
        2) execute_server_action "poweron" ;; 
        3) execute_server_action "shutdown" ;; 
        4) echo -e "\n${COLOR_BLUE}👋 Exiting.${COLOR_RESET}"; break ;; 
        *) echo -e "\n${COLOR_RED}❌ Invalid option, please try again.${COLOR_RESET}" ;; 
    esac
done