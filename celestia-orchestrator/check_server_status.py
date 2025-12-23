import os
import sys
import requests
from dotenv import load_dotenv
from tabulate import tabulate

def get_hetzner_servers():
    """
    Fetches all servers from the Hetzner Cloud API.
    """
    # 1. Load API Token from .env file
    load_dotenv()
    api_token = os.getenv("HETZNER_API_TOKEN")

    if not api_token:
        print("❌ Error: HETZNER_API_TOKEN not found in .env file.")
        sys.exit(1)

    # 2. Prepare and send the API request
    print("🔍 Fetching server statuses from Hetzner Cloud...")
    headers = {"Authorization": f"Bearer {api_token}"}
    url = "https://api.hetzner.cloud/v1/servers"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raises an exception for bad status codes (4xx or 5xx)
        
        data = response.json()
        if "error" in data:
            print(f"❌ API Error: {data['error']['message']}")
            sys.exit(1)
            
        return data.get("servers", [])
        
    except requests.exceptions.RequestException as e:
        print(f"❌ HTTP Request failed: {e}")
        sys.exit(1)

def display_server_status(servers):
    """
    Processes the server list and displays the summary and detailed table.
    """
    if not servers:
        print("No servers found in the project.")
        return

    # 3. Calculate summary counts
    total_count = len(servers)
    online_count = sum(1 for s in servers if s.get("status") == "running")
    offline_count = sum(1 for s in servers if s.get("status") == "off")

    print("=========================================='")
    print("📊 Server Status Summary")
    print("=========================================='")
    print(f"Total Servers: {total_count}")
    print(f"  - ✅ Online:  {online_count}")
    print(f"  - 🔌 Offline: {offline_count}")
    print("=========================================='")
    print("\n📋 Detailed Server List:")

    # 4. Prepare data for the table
    table_data = []
    headers = ["ID", "Name", "Status", "IPv4", "Location", "Type"]

    for server in servers:
        table_data.append([
            server.get("id"),
            server.get("name"),
            server.get("status"),
            server.get("public_net", {}).get("ipv4", {}).get("ip"),
            server.get("datacenter", {}).get("location", {}).get("name"),
            server.get("server_type", {}).get("name")
        ])
        
    # 5. Print the formatted table
    print(tabulate(table_data, headers=headers, tablefmt="grid"))
    print("\n🎉 Status check complete.")


if __name__ == "__main__":
    server_list = get_hetzner_servers()
    display_server_status(server_list)
