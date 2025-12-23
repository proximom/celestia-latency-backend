import os
import sys
import requests
import time
from dotenv import load_dotenv

def main():
    """
    Lists all running servers in the Hetzner Cloud project and gracefully shuts them down.
    """
    load_dotenv()
    api_token = os.getenv("HETZNER_API_TOKEN")

    if not api_token:
        print("❌ Error: HETZNER_API_TOKEN not found in .env file.")
        sys.exit(1)

    base_url = "https://api.hetzner.cloud/v1"
    headers = {"Authorization": f"Bearer {api_token}"}

    print("🚀 Starting server shutdown process...")
    
    try:
        # 1. List all servers
        print("🔍 Fetching list of all servers...")
        response = requests.get(f"{base_url}/servers", headers=headers)
        response.raise_for_status()
        servers_data = response.json().get("servers", [])
        
        if not servers_data:
            print("✅ No servers found in your project to shut down.")
            sys.exit(0)

        running_servers = [s for s in servers_data if s.get("status") == "running"]
        
        if not running_servers:
            print("✅ No running servers detected. All are already off.")
            sys.exit(0)

        print(f"🔌 Detected {len(running_servers)} running server(s). Initiating graceful shutdown...")
        
        shutdown_attempts = []
        for server in running_servers:
            server_id = server["id"]
            server_name = server["name"]
            
            print(f"  - Attempting to shut down '{server_name}' (ID: {server_id})...")
            try:
                # 2. Send shutdown command
                shutdown_response = requests.post(
                    f"{base_url}/servers/{server_id}/actions/shutdown",
                    headers=headers
                )
                shutdown_response.raise_for_status()
                print(f"  - ✅ Shutdown command sent for '{server_name}'.")
                shutdown_attempts.append({"server": server_name, "status": "sent"})
            except requests.exceptions.RequestException as e:
                print(f"  - ❌ Failed to send shutdown command for '{server_name}': {e}")
                shutdown_attempts.append({"server": server_name, "status": "failed", "error": str(e)})
        
        print("\n⏳ Waiting a moment for servers to power off...")
        time.sleep(10) # Give servers a moment to start shutting down

        # 3. Verify status after attempts
        print("\n🔍 Verifying final server statuses:")
        final_list_response = requests.get(f"{base_url}/servers", headers=headers)
        final_list_response.raise_for_status()
        final_servers_data = final_list_response.json().get("servers", [])

        all_off = True
        for server_attempt in shutdown_attempts:
            server_name = server_attempt["server"]
            current_status = "unknown"
            for s in final_servers_data:
                if s["name"] == server_name:
                    current_status = s["status"]
                    break
            
            if current_status == "off":
                print(f"  - ✅ '{server_name}' is now off.")
            else:
                all_off = False
                print(f"  - ⚠️  '{server_name}' is still '{current_status}'. Manual check may be required.")
                
        if all_off:
            print("\n🎉 All targeted servers are now off!")
        else:
            print("\n⚠️ Some servers may not have shut down. Please check your Hetzner Cloud Console.")

    except requests.exceptions.RequestException as e:
        print(f"❌ A critical error occurred during API communication: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
