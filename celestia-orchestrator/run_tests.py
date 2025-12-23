import os
import sys
import logging
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from hcloud import Client
from hcloud.images.domain import Image
from hcloud.server_types.domain import ServerType
from hcloud.locations.domain import Location
from hcloud.ssh_keys.domain import SSHKey

# --- Logger Setup ---
log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
timestamp = datetime.now().isoformat().replace(":", "-").split('.')[0]
log_file = log_dir / f"orchestrator-py-{timestamp}.log"

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s]: %(message)s",
    handlers=[
        # ✅ FIX: Specify UTF-8 encoding for file handler
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)

# --- Configuration ---
# Load environment variables from .env file
dotenv_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

HETZNER_TOKEN = os.getenv("HETZNER_API_TOKEN")
BACKEND_API_URL = os.getenv("BACKEND_API_URL")
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY")
GIT_REPO_URL = os.getenv("GIT_REPO_URL")
HETZNER_SSH_KEY_ID = os.getenv("HETZNER_SSH_KEY_ID")

TEST_REGIONS = ["fsn1", "nbg1", "hel1", "ash"]
SERVER_TYPE = "cpx11"
SERVER_IMAGE = "ubuntu-22.04"

# --- Validation ---
def validate_config():
    """Ensure all required environment variables are set."""
    # Temporarily removed HETZNER_SSH_KEY_ID from validation for testing
    required = {
        "HETZNER_API_TOKEN": HETZNER_TOKEN,
        "BACKEND_API_URL": BACKEND_API_URL,
        "BACKEND_API_KEY": BACKEND_API_KEY,
        "GIT_REPO_URL": GIT_REPO_URL,
    }
    missing = [key for key, value in required.items() if not value]
    if missing:
        logging.error("Missing required environment variables:")
        for key in missing:
            logging.error(f"   - {key}")
        logging.error("\nPlease check your .env file.")
        sys.exit(1)

# --- Main Orchestration ---
def run_orchestration():
    """Main function to create servers in all test regions."""
    # ✅ FIX: Removed emoji from log messages
    logging.info("Starting orchestration (using Python)...")
    validate_config()

    try:
        client = Client(token=HETZNER_TOKEN)
        logging.info("Hetzner client initialized.")

        # ✅ FIX: Specify UTF-8 encoding when reading file
        cloud_init_path = Path(__file__).parent / "cloud-init.sh"
        cloud_init_template = cloud_init_path.read_text(encoding="utf-8")
        
        results = []

        for region in TEST_REGIONS:
            server_name = f"latency-tester-py-{region}-{int(datetime.now().timestamp())}"
            logging.info(f"Creating server in {region}... (Name: {server_name})")

            # Replace placeholders in the cloud-init script
            final_cloud_init = (
                cloud_init_template.replace("__HETZNER_API_TOKEN__", HETZNER_TOKEN)
                .replace("__GIT_REPO_URL__", GIT_REPO_URL)
                .replace("__BACKEND_API_URL__", BACKEND_API_URL)
                .replace("__BACKEND_API_KEY__", BACKEND_API_KEY)
                .replace("__REGION__", region)
            )

            try:
                # Create the server using the hcloud-python library
                # ✅ TEMP FIX: SSH Keys are commented out to prove they are the source of the error
                response = client.servers.create(
                    name=server_name,
                    server_type=ServerType(name=SERVER_TYPE),
                    image=Image(name=SERVER_IMAGE),
                    location=Location(name=region),
                    # ssh_keys=[SSHKey(id=int(HETZNER_SSH_KEY_ID))],
                    user_data=final_cloud_init,
                    labels={"project": "celestia-latency-monitor", "region": region},
                )
                server = response.server
                logging.info(f"   - Server creation initiated (ID: {server.id})")
                results.append({"region": region, "success": True, "serverId": server.id})

            except Exception as e:
                logging.error(f"   - Failed to create server in {region}: {e}")
                results.append({"region": region, "success": False, "error": str(e)})

        # Summary
        logging.info("========================================")
        logging.info("Orchestration Summary:")
        successful = sum(1 for r in results if r["success"])
        failed = len(results) - successful
        logging.info(f"Successful creations: {successful}/{len(TEST_REGIONS)}")
        logging.info(f"Failed creations: {failed}/{len(TEST_REGIONS)}")

        if failed > 0:
            logging.warning("Failed regions:")
            for r in results:
                if not r["success"]:
                    logging.warning(f"   - {r['region']}: {r['error']}")
        
        logging.info("\nOrchestration complete!")
        logging.info("See full details in the log file.")

    except Exception as e:
        logging.error(f"A fatal error occurred during orchestration: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_orchestration()
