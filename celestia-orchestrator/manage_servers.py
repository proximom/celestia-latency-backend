import os
import sys
import requests
from dotenv import load_dotenv
from tabulate import tabulate

class HetznerManager:
    """A client to interact with the Hetzner Cloud API for server management."""
    def __init__(self, api_token):
        if not api_token:
            raise ValueError("HETZNER_API_TOKEN cannot be empty.")
        self.base_url = "https://api.hetzner.cloud/v1"
        self.headers = {"Authorization": f"Bearer {api_token}"}
        self.servers = []

    def fetch_servers(self):
        """Fetches and caches the list of servers."""
        print("\n🔍 Fetching server list from Hetzner Cloud...")
        try:
            response = requests.get(f"{self.base_url}/servers", headers=self.headers)
            response.raise_for_status()
            self.servers = response.json().get("servers", [])
            print("✅ Done.")
            return True
        except requests.exceptions.RequestException as e:
            print(f"❌ HTTP Request failed: {e}")
            return False

    def display_servers(self):
        """Displays the cached server list in a formatted table."""
        if not self.servers:
            print("No servers found or list has not been fetched yet. Please use option 1 first.")
            return
        
        table_data = []
        headers = ["#", "ID", "Name", "Status", "IPv4", "Location"]

        for i, server in enumerate(self.servers, 1):
            table_data.append([
                i,
                server.get("id"),
                server.get("name"),
                server.get("status"),
                server.get("public_net", {}).get("ipv4", {}).get("ip"),
                server.get("datacenter", {}).get("location", {}).get("name")
            ])
            
        print(tabulate(table_data, headers=headers, tablefmt="grid"))

    def _execute_action(self, server_id, action):
        """Executes a power action (poweron, shutdown) on a server."""
        try:
            print(f"  - Sending '{action}' command to server ID {server_id}...")
            response = requests.post(
                f"{self.base_url}/servers/{server_id}/actions/{action}",
                headers=self.headers
            )
            response.raise_for_status()
            print(f"  - ✅ Command sent successfully!")
        except requests.exceptions.RequestException as e:
            print(f"  - ❌ Failed to send command: {e}")

    def power_on_flow(self):
        """Handles the user flow for powering on a server."""
        try:
            server_id = input("▶️ Enter the server ID to power ON: ")
            if not server_id.isdigit():
                print("❌ Invalid ID. Please enter a number.")
                return
            self._execute_action(server_id, "poweron")
        except KeyboardInterrupt:
            print("\nCancelled.")

    def power_off_flow(self):
        """Handles the user flow for powering off a server."""
        try:
            server_id = input("▶️ Enter the server ID to power OFF: ")
            if not server_id.isdigit():
                print("❌ Invalid ID. Please enter a number.")
                return
            self._execute_action(server_id, "shutdown")
        except KeyboardInterrupt:
            print("\nCancelled.")


def display_menu():
    """Prints the main menu."""
    print("\n--- Hetzner Server Manager ---")
    print("1. List and Refresh Servers")
    print("2. Power ON a Server")
    print("3. Power OFF a Server")
    print("4. Exit")
    return input("Choose an option: ")

def main():
    """Main application loop."""
    load_dotenv()
    api_token = os.getenv("HETZNER_API_TOKEN")
    if not api_token:
        print("❌ Error: HETZNER_API_TOKEN not found in .env file.")
        sys.exit(1)
        
    manager = HetznerManager(api_token)
    
    # Fetch servers on start
    manager.fetch_servers()
    manager.display_servers()

    while True:
        try:
            choice = display_menu()
            if choice == '1':
                if manager.fetch_servers():
                    manager.display_servers()
            elif choice == '2':
                manager.power_on_flow()
            elif choice == '3':
                manager.power_off_flow()
            elif choice == '4':
                print("👋 Exiting.")
                break
            else:
                print("❌ Invalid option, please try again.")
        except KeyboardInterrupt:
            print("\n👋 Exiting.")
            break
        except Exception as e:
            print(f"\nAn unexpected error occurred: {e}")


if __name__ == "__main__":
    main()
