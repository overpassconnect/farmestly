param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$ProjectName,
    
    [Parameter(Mandatory=$true)]
    [string]$Server,
    
    [Parameter(Mandatory=$false)]
    [string]$Username,
    
    [Parameter(Mandatory=$false)]
    [string]$RemoteScriptPath,
    
    [Parameter(Mandatory=$false)]
    [string]$RemoteSourceDir,
    
    [Parameter(Mandatory=$false)]
    [string]$RemoteWorkDir,
    
    [Parameter(Mandatory=$false)]
    [string]$LocalDestDir
)

# ============================================
# HARDCODED CONSTANTS - Edit these for your setup
# ============================================
$DEFAULT_USERNAME = "dev"
$DEFAULT_REMOTE_SCRIPT_PATH = "/home/dev/myapp/scripts/prompt_files_generation.sh"
$DEFAULT_REMOTE_SOURCE_DIR = "/home/dev/myapp/packages/"
$DEFAULT_REMOTE_WORK_DIR = "/tmp/"  # Where the .prompt_files folder will be created

# Generate timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Apply defaults if parameters not provided
if (-not $Username) { $Username = $DEFAULT_USERNAME }
if (-not $RemoteScriptPath) { $RemoteScriptPath = $DEFAULT_REMOTE_SCRIPT_PATH }
if (-not $RemoteSourceDir) { $RemoteSourceDir = $DEFAULT_REMOTE_SOURCE_DIR }
if (-not $RemoteWorkDir) { $RemoteWorkDir = $DEFAULT_REMOTE_WORK_DIR }
if (-not $LocalDestDir) { 
    $LocalDestDir = ".\.prompt_files_${ProjectName}_${timestamp}"
}

# Show usage and current settings
Write-Host "Current settings:" -ForegroundColor Yellow
Write-Host "  Project: $ProjectName"
Write-Host "  Server: $Server"
Write-Host "  Username: $Username"
Write-Host "  Script: $RemoteScriptPath"
Write-Host "  Source: $RemoteSourceDir"
Write-Host "  Work Dir: $RemoteWorkDir"
Write-Host "  Local Dir: $LocalDestDir"
Write-Host ""

# Run the script remotely from specific directory
Write-Host "Running script remotely..." -ForegroundColor Green
$remoteCommand = "cd $RemoteWorkDir && $RemoteScriptPath $RemoteSourceDir"
Write-Host "Executing: ssh $Username@$Server `"$remoteCommand`"" -ForegroundColor Cyan
ssh "$Username@$Server" "$remoteCommand"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Remote script execution failed!" -ForegroundColor Red
    exit 1
}

# Copy the output folder locally
Write-Host "Copying files locally..." -ForegroundColor Green
$scpSource = "$Username@$Server`:$RemoteWorkDir.prompt_files"
Write-Host "Executing: scp -r $scpSource $LocalDestDir" -ForegroundColor Cyan
scp -r "$scpSource" "$LocalDestDir"

if ($LASTEXITCODE -ne 0) {
    Write-Host "File copy failed!" -ForegroundColor Red
    exit 1
}

# Delete the remote output folder
Write-Host "Cleaning up remote files..." -ForegroundColor Green
$cleanupCommand = "rm -rf $RemoteWorkDir.prompt_files"
Write-Host "Executing: ssh $Username@$Server `"$cleanupCommand`"" -ForegroundColor Cyan
ssh "$Username@$Server" "$cleanupCommand"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "SUCCESS: Files copied to:" -ForegroundColor Green
Write-Host "$LocalDestDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green