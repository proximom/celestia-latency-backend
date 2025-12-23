# Linux Mini-Book

## Command Index
*   [Chapter 1: The Basics](#chapter-1-the-basics)
*   [Chapter 2: Permissions & Tools](#chapter-2-permissions--tools)
*   [Chapter 3: Processes & Services](#chapter-3-processes--services)

---

## Chapter 1: The Basics

*   **Key Commands:**
    *   `ls`: List files and directories.
    *   `cd`: Change directory.
    *   `pwd`: Print working directory.
    *   `mkdir`: Create a new directory.
    *   `rmdir`: Remove an empty directory.
    *   `touch`: Create an empty file.
    *   `rm`: Remove a file.
    *   `cp`: Copy a file.
    *   `mv`: Move or rename a file.
    *   `cat`: Display file content.
    *   `less`: View file content page by page.
    *   `man`: Display the manual for a command.

*   **Aha Moments:**
    1.  The terminal is not as intimidating as it looks! It's just a way to talk to the computer directly.
    2.  The filesystem is like a big tree, and `cd` is how you climb around it.
    3.  Permissions are like the bouncers of the file system, controlling who gets to do what.

*   **Example Task:**
    *   Create a directory called `my-project`.
    *   Inside `my-project`, create a file called `notes.txt`.
    *   Add the text "Hello, Linux!" to `notes.txt`.
    *   Copy `notes.txt` to `notes_backup.txt`.
    *   Create a subdirectory called `archive`.
    *   Move `notes_backup.txt` into the `archive` directory.

---

## Chapter 2: Permissions & Tools

*   **Permission Cheat Sheet:**
    *   `chmod`: Change permissions.
        *   `u` (user), `g` (group), `o` (other), `a` (all)
        *   `+` (add), `-` (remove), `=` (set)
        *   `r` (read), `w` (write), `x` (execute)
        *   Example: `chmod u+x script.sh` (makes the script executable for the user)
        *   Numeric a.k.a Octal Notations: 
            *   `4` -> Read
            *   `2` -> Write
            *   `1` -> Execute
    *   `chown`: Change owner.
        *   Example: `chown new_owner file.txt`
    *   `chgrp`: Change group.
        *   Example: `chgrp new_group file.txt`

*   **Real-World Examples:**
    1.  **Securing a configuration file:** You have a file `config.ini` with sensitive information. You want to make sure only the owner can read and write to it, and no one else can access it.
        ```bash
        chmod 600 config.ini
        ```
    2.  **Shared project folder:** You have a directory for a team project. You want everyone in the `developers` group to be able to read, write, and access files in the directory.
        ```bash
        chgrp developers /path/to/project_folder
        chmod g+rws /path/to/project_folder
        ```

---

## Chapter 3: Processes & Services

*   **Sample Service File:**
    ```
    [Unit]
    Description=My Python Service
    After=network.target

    [Service]
    ExecStart=/usr/bin/python3 /path/to/my_service.py
    Restart=always
    User=your_user

    [Install]
    WantedBy=multi-user.target
    ```

*   **Common journalctl Commands:**
    *   `journalctl -u my_service.service`: View logs for a specific service.
    *   `journalctl -f`: Follow new logs in real-time.
    *   `journalctl -p err`: Filter logs by priority (e.g., errors).
    ```

---

## Troubleshooting Notes

*   **"Permission denied":** This is a common error. Use `ls -l` to check the permissions of the file or directory. You may need to use `sudo` to run the command with root privileges, or use `chmod` to change the permissions.
*   **"Command not found":** This means the command you are trying to run is not in your `PATH`. You may need to install the command or specify the full path to it.
*   **"No such file or directory":** Double-check your spelling and make sure you are in the correct directory. Use `pwd` to see your current location.
*   **"Read-only file system":** You are trying to write to a file system that is mounted as read-only. You may need to remount it as read-write.
