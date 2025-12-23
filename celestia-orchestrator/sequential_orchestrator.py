import os
import sys
import time
import requests
import paramiko
from dotenv import load_dotenv

# --- Configuration ---
def load_config():
    """Loads and validates configuration from environment variables."""
    load_dotenv()
    config = {
        "HETZNER_API_TOKEN": os.getenv("HETZNER_API_TOKEN"),
        "BACKEND_API_URL": os.getenv("BACKEND_API_URL"),
        "BACKEND_API_KEY": os.getenv("BACKEND_API_KEY"),
        "HETZNER_SSH_PRIVATE_KEY_PATH": os.getenv("HETZNER_SSH_PRIVATE_KEY_PATH"),
        "HETZNER_SSH_PASSPHRASE": os.getenv("HETZNER_SSH_PASSPHRASE"), # ✅ Added passphrase
        "REMOTE_PROJECT_PATH": os.getenv("REMOTE_PROJECT_PATH"),
        "GIT_REPO_URL": os.getenv("GIT_REPO_URL")
    }
    
    # Note: SSH Passphrase is optional, so we don't validate its presence.
    required_vars = [key for key, value in config.items() if key != "HETZNER_SSH_PASSPHRASE" and not value]
    if required_vars:
        print(f"❌ Error: Missing required environment variables: {', '.join(required_vars)}")
        sys.exit(1)
        
    print("✅ Configuration loaded successfully.")
    return config

# --- Hetzner API Interaction ---
class HetznerAPI:
    def __init__(self, token):
        self.base_url = "https://api.hetzner.cloud/v1"
        self.headers = {"Authorization": f"Bearer {token}"}

    def _get_server_id(self, server_name):
        response = requests.get(f"{self.base_url}/servers?name={server_name}", headers=self.headers)
        response.raise_for_status()
        servers = response.json().get("servers", [])
        if not servers:
            raise Exception(f"Server with name '{server_name}' not found.")
        return servers[0]["id"]

    def power_on_server(self, server_name):
        server_id = self._get_server_id(server_name)
        print(f"  - Sending POWER ON command to {server_name} (ID: {server_id})...")
        response = requests.post(f"{self.base_url}/servers/{server_id}/actions/poweron", headers=self.headers)
        response.raise_for_status()
        return response.json()

    def power_off_server(self, server_name):
        server_id = self._get_server_id(server_name)
        print(f"  - Sending POWER OFF command to {server_name} (ID: {server_id})...")
        response = requests.post(f"{self.base_url}/servers/{server_id}/actions/shutdown", headers=self.headers)
        response.raise_for_status()
        return response.json()
        
    def get_server_ip(self, server_name):
        server_id = self._get_server_id(server_name)
        response = requests.get(f"{self.base_url}/servers/{server_id}", headers=self.headers)
        response.raise_for_status()
        server = response.json().get("server", {})
        ip = server.get("public_net", {}).get("ipv4", {}).get("ip")
        if not ip:
            return None
        return ip

# --- SSH and Remote Execution ---
def is_ssh_ready(server_ip, ssh_key_path, ssh_passphrase):
    """Checks if a server is ready to accept an SSH connection, using a passphrase if provided."""
    try:
        with paramiko.SSHClient() as ssh:
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            # ✅ Use passphrase when connecting
            private_key = paramiko.Ed25519Key(filename=ssh_key_path, password=ssh_passphrase)
            ssh.connect(server_ip, username='root', pkey=private_key, timeout=5)
        return True
    except Exception:
        return False

def run_remote_task(server_ip, ssh_key_path, ssh_passphrase, remote_project_path, git_repo_url, region, api_key, backend_url):
    """Connects to a server via SSH and runs the monitoring script, using a passphrase if provided."""
    print(f"  - Preparing to connect to {server_ip} via SSH...")
    
    with paramiko.SSHClient() as ssh:
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        # ✅ Use passphrase when connecting
        private_key = paramiko.Ed25519Key(filename=ssh_key_path, password=ssh_passphrase)
        ssh.connect(server_ip, username='root', pkey=private_key, timeout=10)
        print(f"  - ✅ SSH connection successful.")

        # Command to check if repo exists, and clone if it doesn't
        setup_command = f"""
        if [ ! -d "{remote_project_path}" ]; then
            echo "Cloning repository...";
            git clone {git_repo_url} {remote_project_path};
        else
            echo "Repository already exists. Pulling latest changes...";
            cd {remote_project_path} && git pull;
        fi
        """
        stdin, stdout, stderr = ssh.exec_command(setup_command)
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            raise Exception(f"Failed to set up remote repository: {stderr.read().decode().strip()}")
        print(f"  - ✅ Remote repository is ready.")

        # Command to run the monitor script
        monitor_command = f"""
        export BACKEND_API_URL="{backend_url}"
        export API_KEY="{api_key}"
        export REGION="{region}"
        cd "{remote_project_path}"
        ./monitor_endpoints.sh
        """
        print(f"  - 🧪 Executing monitor script in region '{region}'...")
        stdin, stdout, stderr = ssh.exec_command(monitor_command)
        exit_status = stdout.channel.recv_exit_status()
        
        if exit_status == 0:
            print(f"  - ✅ Monitor script completed successfully.")
        else:
            print(f"  - ❌ Monitor script failed with exit code {exit_status}.")
            print(f"  - STDERR: {stderr.read().decode().strip()}")
        
        return exit_status == 0

# --- Main Orchestration Logic ---
def main():
    config = load_config()
    hetzner = HetznerAPI(config["HETZNER_API_TOKEN"])

    servers_to_test = {
        "rocky-ash-1": "ash",
        "rocky-hil-1": "us-west",
        "rocky-nbg1-1": "nbg1",
        "rocky-hel1-3": "hel1",
        "rocky-sin-1": "sin1"
    }

    print(f"\n🚀 Starting Sequential Orchestration for {len(servers_to_test)} servers...\n")

    for server_name, region in servers_to_test.items():
        print(f"==========================================")
        print(f"▶️ Processing Server: {server_name}")
        print(f"==========================================")
        
        try:
            # 1. Power on
            hetzner.power_on_server(server_name)
            
            # 2. Wait for server to be ready
            print(f"  - Waiting for {server_name} to boot and become available via SSH...")
            server_ip = None
            for i in range(40): # Max wait time: 40 * 10s = ~7 minutes
                ip = hetzner.get_server_ip(server_name)
                # ✅ Pass passphrase to SSH readiness check
                if ip and is_ssh_ready(ip, config["HETZNER_SSH_PRIVATE_KEY_PATH"], config["HETZNER_SSH_PASSPHRASE"]):
                    server_ip = ip
                    print(f"  - ✅ Server is online and ready at {server_ip}.")
                    break
                print(f"  - Attempt {i+1}/40: Server not ready yet. Waiting 10 seconds...")
                time.sleep(10)
            
            if not server_ip:
                raise Exception("Server did not become SSH-ready in time.")

            # 3. Run remote task
            # ✅ Pass passphrase to the main remote task function
            run_remote_task(
                server_ip,
                config["HETZNER_SSH_PRIVATE_KEY_PATH"],
                config["HETZNER_SSH_PASSPHRASE"],
                config["REMOTE_PROJECT_PATH"],
                config["GIT_REPO_URL"],
                region,
                config["BACKEND_API_KEY"],
                config["BACKEND_API_URL"]
            )

        except Exception as e:
            print(f"  - ❌ An error occurred while processing {server_name}: {e}")
        
        finally:
            # 4. Power off server, regardless of success or failure
            print(f"  - Initiating shutdown for {server_name}...")
            try:
                hetzner.power_off_server(server_name)
                print(f"  - ✅ Shutdown command sent successfully.")
            except Exception as e:
                print(f"  - ❌ Failed to send shutdown command for {server_name}: {e}")
        
        print("\n")

    print("🎉 All server tests completed!")

if __name__ == "__main__":
    main()
