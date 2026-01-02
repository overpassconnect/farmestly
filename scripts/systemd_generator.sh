#!/bin/bash

# Production-Ready Node.js Systemd Service Generator
# This script creates and enables a systemd service for a Node.js application
# with comprehensive error handling and edge case management
# Usage: ./script.sh [path-to-main-js-file] [service-name] [username]

set -euo pipefail
IFS=$'\n\t'

# Production configuration
readonly SCRIPT_VERSION="2.0.0"
readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly LOCK_FILE="/tmp/${SCRIPT_NAME}.lock"
readonly LOG_FILE="/var/log/${SCRIPT_NAME}.log"
readonly BACKUP_DIR="/etc/systemd/system/.backups"

# Default configuration
readonly DEFAULT_SERVICE_NAME="nodejs-app"
readonly DEFAULT_USER="nodeuser"
readonly DEFAULT_GROUP="nodeuser"
readonly NODE_ENV="production"

# Global variables for rollback
declare -a CREATED_FILES=()
declare -a CREATED_USERS=()
declare -a BACKUP_FILES=()

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$1] $2" | tee -a "$LOG_FILE" >&2
}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
    log "INFO" "$1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log "WARNING" "$1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "ERROR" "$1"
}

print_info() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
    log "DEBUG" "$1"
}

# Cleanup and rollback functions
cleanup() {
    local exit_code=$?
    
    if [[ $exit_code -ne 0 ]]; then
        print_error "Script failed with exit code $exit_code. Initiating rollback..."
        rollback_changes
    fi
    
    # Remove lock file
    [[ -f "$LOCK_FILE" ]] && rm -f "$LOCK_FILE"
    
    exit $exit_code
}

rollback_changes() {
    print_warning "Rolling back changes..."
    
    # Stop and disable service if it was created
    if [[ -n "${SERVICE_NAME:-}" ]] && systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
        print_info "Stopping and disabling service: $SERVICE_NAME"
        systemctl stop "$SERVICE_NAME" 2>/dev/null || true
        systemctl disable "$SERVICE_NAME" 2>/dev/null || true
    fi
    
    # Remove created files
    for file in "${CREATED_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            print_info "Removing created file: $file"
            rm -f "$file"
        fi
    done
    
    # Restore backup files
    for backup in "${BACKUP_FILES[@]}"; do
        if [[ -f "$backup" ]]; then
            local original="${backup%.backup}"
            print_info "Restoring backup: $backup -> $original"
            mv "$backup" "$original"
        fi
    done
    
    # Remove created users (optional - commented out for safety)
    # for user in "${CREATED_USERS[@]}"; do
    #     print_info "Removing created user: $user"
    #     userdel "$user" 2>/dev/null || true
    # done
    
    systemctl daemon-reload 2>/dev/null || true
    print_warning "Rollback completed"
}

# Trap for cleanup
trap cleanup EXIT INT TERM

# Validation functions
validate_service_name() {
    local name="$1"
    
    # Check length
    if [[ ${#name} -gt 64 ]]; then
        print_error "Service name too long (max 64 characters): $name"
        return 1
    fi
    
    # Check for valid characters (letters, numbers, hyphens, underscores, dots)
    if [[ ! "$name" =~ ^[a-zA-Z0-9._-]+$ ]]; then
        print_error "Invalid service name. Use only letters, numbers, dots, hyphens, and underscores: $name"
        return 1
    fi
    
    # Check if it starts with a letter
    if [[ ! "$name" =~ ^[a-zA-Z] ]]; then
        print_error "Service name must start with a letter: $name"
        return 1
    fi
    
    return 0
}

validate_username() {
    local username="$1"
    
    # Check length
    if [[ ${#username} -gt 32 ]]; then
        print_error "Username too long (max 32 characters): $username"
        return 1
    fi
    
    # Check for valid characters
    if [[ ! "$username" =~ ^[a-z][-a-z0-9]*$ ]]; then
        print_error "Invalid username. Use only lowercase letters, numbers, and hyphens: $username"
        return 1
    fi
    
    return 0
}

validate_env_file() {
    local env_file="$1"
    local line_num=0
    local errors=0
    
    print_info "Validating .env file: $env_file"
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))
        
        # Skip empty lines and comments
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        
        # Remove export prefix for validation
        local clean_line="$line"
        [[ "$line" =~ ^export[[:space:]]+ ]] && clean_line="${line#export }"
        
        # Check for valid variable assignment
        if [[ ! "$clean_line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*= ]]; then
            print_warning "Line $line_num: Invalid variable assignment: $line"
            ((errors++))
            continue
        fi
        
        # Extract variable name and value
        local var_name="${clean_line%%=*}"
        local var_value="${clean_line#*=}"
        
        # Validate variable name
        if [[ ! "$var_name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
            print_warning "Line $line_num: Invalid variable name: $var_name"
            ((errors++))
            continue
        fi
        
        # Check for multi-line values (unsupported)
        if [[ "$var_value" == *$'\n'* ]]; then
            print_warning "Line $line_num: Multi-line values not supported: $var_name"
            ((errors++))
            continue
        fi
        
        # Check for unquoted special characters
        if [[ "$var_value" =~ [[:space:]\$\`\\] ]] && [[ ! "$var_value" =~ ^[\"\']. ]]; then
            print_warning "Line $line_num: Value with special characters should be quoted: $var_name"
        fi
        
    done < "$env_file"
    
    if [[ $errors -gt 0 ]]; then
        print_error "Found $errors errors in .env file. Please fix them before proceeding."
        return 1
    fi
    
    print_info ".env file validation passed"
    return 0
}

check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check if systemd is available
    if ! command -v systemctl &> /dev/null; then
        print_error "systemctl not found. This system doesn't appear to use systemd."
        return 1
    fi
    
    # Check systemd version
    local systemd_version
    systemd_version=$(systemctl --version | head -n1 | grep -oE '[0-9]+' | head -n1)
    if [[ $systemd_version -lt 220 ]]; then
        print_warning "Old systemd version detected ($systemd_version). Some features may not work correctly."
    fi
    
    # Check available disk space (need at least 1MB)
    local available_space
    available_space=$(df /etc/systemd/system --output=avail | tail -n1)
    if [[ $available_space -lt 1024 ]]; then
        print_error "Insufficient disk space in /etc/systemd/system"
        return 1
    fi
    
    # Check if we can write to systemd directory
    if [[ ! -w /etc/systemd/system ]]; then
        print_error "Cannot write to /etc/systemd/system. Are you running as root?"
        return 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    print_info "System requirements check passed"
    return 0
}

acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid
        lock_pid=$(<"$LOCK_FILE")
        
        if kill -0 "$lock_pid" 2>/dev/null; then
            print_error "Another instance of this script is already running (PID: $lock_pid)"
            return 1
        else
            print_warning "Removing stale lock file"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    return 0
}

# Usage and argument parsing
show_usage() {
    cat << EOF
Production-Ready Node.js Systemd Service Generator v$SCRIPT_VERSION

Usage: $0 [path-to-main-js-file] [service-name] [username]

Examples:
  $0 /home/user/myapp/index.js
  $0 /opt/myapp/server.js my-api-service
  $0 /var/www/app/app.js web-service appuser

Arguments:
  path-to-main-js-file: Path to your main Node.js file (required)
  service-name:         Name for the systemd service (optional)
  username:             User to run the service as (optional)

Features:
  - Automatic path detection and validation
  - Comprehensive .env file handling
  - Atomic operations with rollback capability
  - Production-grade error handling
  - Security hardening options
  - Detailed logging and validation

The script will automatically:
  - Detect and validate all paths
  - Find the Node.js installation
  - Validate and convert .env files
  - Create users with proper security
  - Set up comprehensive logging
  - Handle edge cases and errors gracefully

For support and documentation, see the script comments.
EOF
}

parse_arguments() {
    if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # First argument: path to main JS file (required)
    MAIN_FILE_PATH="$1"
    
    # Validate and resolve path
    if [[ ! -f "$MAIN_FILE_PATH" ]]; then
        print_error "Main file not found: $MAIN_FILE_PATH"
        exit 1
    fi
    
    # Resolve to absolute path, handling spaces and special characters
    MAIN_FILE_PATH=$(realpath "$MAIN_FILE_PATH")
    APP_DIR=$(dirname "$MAIN_FILE_PATH")
    MAIN_FILE=$(basename "$MAIN_FILE_PATH")
    
    # Validate file is readable
    if [[ ! -r "$MAIN_FILE_PATH" ]]; then
        print_error "Cannot read main file: $MAIN_FILE_PATH"
        exit 1
    fi
    
    # Second argument: service name (optional)
    if [[ -n "${2:-}" ]]; then
        SERVICE_NAME="$2"
    else
        # Generate service name from file name
        local basename
        basename=$(basename "$MAIN_FILE_PATH" .js)
        SERVICE_NAME="${basename}-service"
    fi
    
    # Validate service name
    validate_service_name "$SERVICE_NAME"
    
    # Third argument: username (optional)
    if [[ -n "${3:-}" ]]; then
        USER="$3"
        GROUP="$3"
    else
        USER="$DEFAULT_USER"
        GROUP="$DEFAULT_GROUP"
    fi
    
    # Validate username
    validate_username "$USER"
}

auto_detect_node() {
    print_status "Detecting Node.js installation..."
    
    # Try multiple methods to find Node.js
    local node_candidates=(
        "$(command -v node 2>/dev/null || true)"
        "$(command -v nodejs 2>/dev/null || true)"
        "/usr/bin/node"
        "/usr/local/bin/node"
        "/opt/node/bin/node"
        "$HOME/.nvm/current/bin/node"
        "/usr/bin/nodejs"
    )
    
    for candidate in "${node_candidates[@]}"; do
        if [[ -n "$candidate" ]] && [[ -x "$candidate" ]]; then
            NODE_PATH="$candidate"
            break
        fi
    done
    
    if [[ -z "${NODE_PATH:-}" ]]; then
        print_error "Node.js not found. Please install Node.js first."
        print_info "Searched locations: ${node_candidates[*]}"
        return 1
    fi
    
    # Validate Node.js works
    if ! NODE_VERSION=$("$NODE_PATH" --version 2>/dev/null); then
        print_error "Node.js found but not working: $NODE_PATH"
        return 1
    fi
    
    print_info "Node.js found: $NODE_PATH ($NODE_VERSION)"
    
    # Warn about old Node.js versions
    local version_number
    version_number=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [[ $version_number -lt 16 ]]; then
        print_warning "Old Node.js version detected ($NODE_VERSION). Consider upgrading to v16+ for production use."
    fi
    
    return 0
}

check_service_conflicts() {
    local service_file="/etc/systemd/system/$SERVICE_NAME.service"
    
    if [[ -f "$service_file" ]]; then
        print_warning "Service $SERVICE_NAME already exists"
        
        if systemctl is-active --quiet "$SERVICE_NAME"; then
            print_warning "Service is currently running"
            
            echo -n "Stop and replace existing service? [y/N]: "
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                print_error "Aborting due to service conflict"
                exit 1
            fi
            
            print_status "Stopping existing service..."
            systemctl stop "$SERVICE_NAME"
        fi
        
        # Create backup
        local backup_file="$BACKUP_DIR/$SERVICE_NAME.service.backup.$(date +%s)"
        cp "$service_file" "$backup_file"
        BACKUP_FILES+=("$backup_file")
        print_info "Backed up existing service to: $backup_file"
    fi
}

create_user_secure() {
    if id "$USER" &>/dev/null; then
        print_status "User $USER already exists"
        
        # Validate existing user settings
        local user_shell
        user_shell=$(getent passwd "$USER" | cut -d: -f7)
        if [[ "$user_shell" != "/bin/false" ]] && [[ "$user_shell" != "/usr/sbin/nologin" ]]; then
            print_warning "User $USER has login shell: $user_shell"
            print_warning "Consider using a dedicated service account"
        fi
    else
        print_status "Creating secure service user: $USER"
        
        # Create system user with security hardening
        useradd \
            --system \
            --no-create-home \
            --home-dir /nonexistent \
            --shell /bin/false \
            --comment "Node.js service user for $SERVICE_NAME" \
            "$USER"
        
        CREATED_USERS+=("$USER")
        print_info "Created system user: $USER"
    fi
}

prepare_env_file_secure() {
    local env_file="$APP_DIR/.env"
    local systemd_env_file="/etc/systemd/system/$SERVICE_NAME.env"
    
    if [[ -f "$env_file" ]]; then
        print_status "Processing .env file: $env_file"
        
        # Validate .env file first
        if ! validate_env_file "$env_file"; then
            return 1
        fi
        
        # Check file size (limit to 1MB)
        local file_size
        file_size=$(stat -c%s "$env_file")
        if [[ $file_size -gt 1048576 ]]; then
            print_error ".env file too large (max 1MB): $file_size bytes"
            return 1
        fi
        
        # Backup existing env file if present
        if [[ -f "$systemd_env_file" ]]; then
            local backup_file="$BACKUP_DIR/$(basename "$systemd_env_file").backup.$(date +%s)"
            cp "$systemd_env_file" "$backup_file"
            BACKUP_FILES+=("$backup_file")
        fi
        
        # Create temporary file first for atomic operation
        local temp_file
        temp_file=$(mktemp)
        
        # Process .env file
        if grep -q "^export " "$env_file"; then
            print_info ".env file uses 'export' syntax - converting to systemd format"
            
            sed -e 's/^export //' \
                -e 's/^\([^=]*\)="\(.*\)"$/\1=\2/' \
                -e 's/^\([^=]*\)='\''\(.*\)'\''$/\1=\2/' \
                -e '/^#/d' \
                -e '/^$/d' \
                "$env_file" > "$temp_file"
        else
            print_info ".env file already in systemd format - copying with cleanup"
            
            sed -e '/^#/d' \
                -e '/^$/d' \
                "$env_file" > "$temp_file"
        fi
        
        # Validate processed file
        if [[ ! -s "$temp_file" ]]; then
            print_warning ".env file resulted in empty output after processing"
            rm -f "$temp_file"
            return 1
        fi
        
        # Atomic move and secure permissions
        mv "$temp_file" "$systemd_env_file"
        chmod 600 "$systemd_env_file"
        chown root:root "$systemd_env_file"
        
        CREATED_FILES+=("$systemd_env_file")
        
        local var_count
        var_count=$(grep -c "=" "$systemd_env_file" 2>/dev/null || echo "0")
        print_status "Environment file created with $var_count variables: $systemd_env_file"
        
        return 0
    else
        print_info "No .env file found at $env_file"
        return 1
    fi
}

create_service_file_secure() {
    local service_file="/etc/systemd/system/$SERVICE_NAME.service"
    local has_env_file=$1
    local temp_file
    
    print_status "Creating systemd service file: $service_file"
    
    # Create service file atomically
    temp_file=$(mktemp)
    
    cat > "$temp_file" << EOF
# Generated by $SCRIPT_NAME v$SCRIPT_VERSION
# Created: $(date)
# Main file: $MAIN_FILE_PATH
# Working directory: $APP_DIR
# Service user: $USER

[Unit]
Description=$SERVICE_NAME Node.js Application
Documentation=https://nodejs.org/
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$GROUP

# Restart configuration
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

# Working directory and execution
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH $MAIN_FILE

# Basic environment variables (always included)
Environment=NODE_ENV=$NODE_ENV
Environment=PATH=/usr/local/bin:/usr/bin:/bin
EOF

    # Add environment file if it exists
    if [[ $has_env_file -eq 0 ]]; then
        cat >> "$temp_file" << EOF

# Load additional variables from .env file
EnvironmentFile=/etc/systemd/system/$SERVICE_NAME.env
EOF
    else
        cat >> "$temp_file" << EOF

# No .env file found - only basic environment variables will be set
EOF
    fi

    cat >> "$temp_file" << EOF

# Logging configuration
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Basic security settings (safe for all configurations)
NoNewPrivileges=true

# Advanced security settings (commented out to avoid CHDIR issues)
# Uncomment and customize these after verifying basic operation:
# ProtectSystem=strict
# ProtectHome=true
# ReadWritePaths=$APP_DIR
# PrivateTmp=true
# PrivateDevices=true
# ProtectKernelTunables=true
# ProtectKernelModules=true
# ProtectControlGroups=true
# RestrictNamespaces=true
# LockPersonality=true
# MemoryDenyWriteExecute=true
# RestrictRealtime=true
# RestrictSUIDSGID=true
# RemoveIPC=true

# Resource limits
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

    # Atomic move and secure permissions
    mv "$temp_file" "$service_file"
    chmod 600 "$service_file"
    chown root:root "$service_file"
    
    CREATED_FILES+=("$service_file")
    print_info "Service file created with root-only permissions (600)"
}

set_ownership_secure() {
    print_status "Setting secure ownership and permissions"
    
    # Ensure app directory is accessible to service user
    if [[ ! -d "$APP_DIR" ]]; then
        print_error "Application directory not found: $APP_DIR"
        return 1
    fi
    
    # Check if we can modify the app directory
    if [[ ! -w "$APP_DIR" ]]; then
        print_warning "Cannot write to app directory: $APP_DIR"
        print_warning "You may need to manually set ownership: chown -R $USER:$GROUP $APP_DIR"
        return 0
    fi
    
    # Set ownership recursively
    chown -R "$USER:$GROUP" "$APP_DIR"
    
    # Set secure permissions
    find "$APP_DIR" -type f -exec chmod 644 {} \;
    find "$APP_DIR" -type d -exec chmod 755 {} \;
    
    # Ensure main file is readable and executable
    chmod 755 "$MAIN_FILE_PATH"
    
    print_info "Ownership set to $USER:$GROUP for: $APP_DIR"
}

enable_and_start_service() {
    print_status "Enabling and starting service: $SERVICE_NAME"
    
    # Reload systemd daemon
    systemctl daemon-reload
    
    # Validate service file syntax
    if ! systemctl cat "$SERVICE_NAME" &>/dev/null; then
        print_error "Invalid service file syntax"
        return 1
    fi
    
    # Enable service
    if ! systemctl enable "$SERVICE_NAME"; then
        print_error "Failed to enable service"
        return 1
    fi
    
    # Start service
    if ! systemctl start "$SERVICE_NAME"; then
        print_error "Failed to start service"
        print_error "Check logs: journalctl -u $SERVICE_NAME -n 50"
        return 1
    fi
    
    # Wait a moment and check if it's still running
    sleep 2
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        print_error "Service started but then failed"
        print_error "Check logs: journalctl -u $SERVICE_NAME -n 50"
        return 1
    fi
    
    print_status "Service started successfully"
}

show_final_status() {
    print_status "=== Service Setup Complete ==="
    
    # Show service status
    systemctl status "$SERVICE_NAME" --no-pager -l || true
    
    echo
    print_status "Configuration Summary:"
    echo "  Application:       $MAIN_FILE_PATH"
    echo "  Service Name:      $SERVICE_NAME"
    echo "  Service User:      $USER"
    echo "  Working Directory: $APP_DIR"
    echo "  Node.js Path:      $NODE_PATH ($NODE_VERSION)"
    echo "  Service File:      /etc/systemd/system/$SERVICE_NAME.service"
    
    if [[ -f "/etc/systemd/system/$SERVICE_NAME.env" ]]; then
        local var_count
        var_count=$(grep -c "=" "/etc/systemd/system/$SERVICE_NAME.env" 2>/dev/null || echo "0")
        echo "  Environment File:  /etc/systemd/system/$SERVICE_NAME.env ($var_count variables)"
    fi
    
    echo
    print_status "Management Commands:"
    echo "  systemctl status $SERVICE_NAME     # Check status"
    echo "  systemctl start $SERVICE_NAME      # Start service"
    echo "  systemctl stop $SERVICE_NAME       # Stop service"
    echo "  systemctl restart $SERVICE_NAME    # Restart service"
    echo "  journalctl -u $SERVICE_NAME -f     # View live logs"
    echo "  journalctl -u $SERVICE_NAME -n 50  # View recent logs"
    echo "  systemctl edit $SERVICE_NAME       # Edit service (override)"
    echo
    
    print_status "Security Notes:"
    echo "  - Service files are readable only by root (600 permissions)"
    echo "  - Service runs as dedicated user: $USER"
    echo "  - Advanced security settings are commented out in service file"
    echo "  - Review and uncomment security settings after testing"
    echo
    
    if [[ ${#BACKUP_FILES[@]} -gt 0 ]]; then
        print_info "Backup files created:"
        printf '  %s\n' "${BACKUP_FILES[@]}"
        echo
    fi
    
    print_status "Production Checklist:"
    echo "  ☐ Test service start/stop/restart"
    echo "  ☐ Verify application logs in journal"
    echo "  ☐ Enable security settings in service file"
    echo "  ☐ Configure log rotation if needed"
    echo "  ☐ Set up monitoring/alerting"
    echo "  ☐ Test service behavior on system restart"
    echo "  ☐ Review environment variables for sensitive data"
}

main() {
    print_status "Production Node.js Systemd Service Generator v$SCRIPT_VERSION"
    print_status "Log file: $LOG_FILE"
    
    # Initialize logging
    mkdir -p "$(dirname "$LOG_FILE")"
    log "INFO" "Script started with arguments: $*"
    
    # Acquire lock to prevent concurrent execution
    if ! acquire_lock; then
        exit 1
    fi
    
    # Parse and validate arguments
    parse_arguments "$@"
    
    # System checks
    check_system_requirements
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    # Auto-detect Node.js
    auto_detect_node
    
    # Check for service conflicts
    check_service_conflicts
    
    # Create secure service user
    create_user_secure
    
    # Process .env file securely
    local has_env_file=1
    if prepare_env_file_secure; then
        has_env_file=0
    fi
    
    # Create service file securely
    create_service_file_secure $has_env_file
    
    # Set secure ownership
    set_ownership_secure
    
    # Enable and start service
    enable_and_start_service
    
    # Show final status
    show_final_status
    
    print_status "Setup completed successfully!"
    log "INFO" "Script completed successfully"
}

# Only run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi