import psutil

def check_cpu():
    """Returns CPU usage percentage."""
    return psutil.cpu_percent(interval=1)

def check_ram():
    """Returns RAM usage information."""
    return psutil.virtual_memory()

def check_disk():
    """Returns disk usage information."""
    return psutil.disk_usage('/')

if __name__ == "__main__":
    print("System Health Checker")
    print("="*20)
    print(f"CPU Usage: {check_cpu()}%")
    ram_info = check_ram()
    print(f"RAM Usage: {ram_info.percent}%")
    disk_info = check_disk()
    print(f"Disk Usage: {disk_info.percent}%")
