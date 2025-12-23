#!/bin/bash

# Create a backup directory
mkdir -p my_backup

# Set permissions: 
# - Owner: read, write, execute
# - Group: read, execute
# - Others: no permissions
chmod 750 my_backup

# Create a group for backups (if it doesn't exist)
if ! grep -q "^backup_users$" /etc/group; then
    groupadd backup_users
fi

# Change the group ownership of the directory
chown :backup_users my_backup

echo "Backup directory 'my_backup' created with restricted permissions."
echo "Owner: $(stat -c "%U" my_backup)"
echo "Group: $(stat -c "%G" my_backup)"
echo "Permissions: $(stat -c "%a" my_backup)"
