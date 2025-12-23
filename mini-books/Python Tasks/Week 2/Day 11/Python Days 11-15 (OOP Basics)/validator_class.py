class ServerValidator:
    def __init__(self, status, uptime):
        self.status = status
        self.uptime = uptime

    def is_online(self):
        return self.status == "online"

    def has_high_uptime(self, threshold=99.9):
        return self.uptime >= threshold

if __name__ == "__main__":
    server1 = ServerValidator("online", 99.95)
    server2 = ServerValidator("offline", 95.0)

    print(f"Server 1 online: {server1.is_online()}")
    print(f"Server 1 high uptime: {server1.has_high_uptime()}")
    print(f"Server 2 online: {server2.is_online()}")
    print(f"Server 2 high uptime: {server2.has_high_uptime()}")
