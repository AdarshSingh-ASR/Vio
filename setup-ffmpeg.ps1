# FFmpeg Setup Script for Vio AI
Write-Host "Setting up FFmpeg for Vio AI..." -ForegroundColor Green

# Create tools directory
$toolsDir = "tools\ffmpeg"
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    Write-Host "Created tools directory: $toolsDir" -ForegroundColor Yellow
}

# Download FFmpeg
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$zipFile = "$toolsDir\ffmpeg.zip"

Write-Host "Downloading FFmpeg..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on your internet connection..." -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "Download completed!" -ForegroundColor Green
} catch {
    Write-Host "Download failed. Please download manually from: $ffmpegUrl" -ForegroundColor Red
    Write-Host "Save it as: $zipFile" -ForegroundColor Red
    exit 1
}

# Extract FFmpeg
Write-Host "Extracting FFmpeg..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipFile -DestinationPath $toolsDir -Force
    Write-Host "Extraction completed!" -ForegroundColor Green
} catch {
    Write-Host "Extraction failed. Please extract manually." -ForegroundColor Red
    exit 1
}

# Find the bin directory
$binDir = Get-ChildItem -Path $toolsDir -Directory -Recurse | Where-Object { $_.Name -eq "bin" } | Select-Object -First 1

if ($binDir) {
    $ffmpegPath = $binDir.FullName
    Write-Host "Found FFmpeg at: $ffmpegPath" -ForegroundColor Green
    
    # Test FFmpeg
    $ffmpegExe = Join-Path $ffmpegPath "ffmpeg.exe"
    if (Test-Path $ffmpegExe) {
        Write-Host "Testing FFmpeg..." -ForegroundColor Yellow
        & $ffmpegExe -version | Select-Object -First 3
        Write-Host "FFmpeg is working!" -ForegroundColor Green
        
        # Create environment file
        $envContent = @"
# FFmpeg Configuration
FFMPEG_PATH=$ffmpegExe
"@
        Set-Content -Path ".env.local" -Value $envContent -Append
        Write-Host "Added FFmpeg path to .env.local" -ForegroundColor Green
        
        Write-Host "`nSetup completed successfully!" -ForegroundColor Green
        Write-Host "FFmpeg is now available at: $ffmpegExe" -ForegroundColor Cyan
        Write-Host "You can now run video generation!" -ForegroundColor Cyan
        
    } else {
        Write-Host "FFmpeg executable not found in: $ffmpegPath" -ForegroundColor Red
    }
} else {
    Write-Host "Could not find FFmpeg bin directory" -ForegroundColor Red
}

# Cleanup
if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
    Write-Host "Cleaned up download file" -ForegroundColor Yellow
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
