def read_log(file_path, filter_level="ERROR"):
    """
    Reads a log file and filters for specific log levels.
    """
    try:
        with open(file_path, 'r') as f:
            for line in f:
                if line.startswith(filter_level):
                    print(line.strip())
    except FileNotFoundError:
        print(f"Error: File not found at {file_path}")

if __name__ == "__main__":
    read_log("app.log")
