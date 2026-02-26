#!/usr/bin/env pwsh
# lrn installer for Windows
# Usage: irm https://uselrn.dev/install.ps1 | iex

$ErrorActionPreference = "Stop"

$repo = "dreamfueldev/lrn"
$installDir = "$env:LOCALAPPDATA\lrn\bin"
$binaryName = "lrn.exe"

Write-Host "lrn installer" -ForegroundColor Cyan

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else {
    Write-Error "32-bit Windows is not supported"; exit 1
}

$binary = "lrn-windows-${arch}.exe"

# Get latest release
Write-Host "> Fetching latest release..." -ForegroundColor Green
$release = Invoke-RestMethod "https://api.github.com/repos/${repo}/releases/latest"
$version = $release.tag_name
$asset = $release.assets | Where-Object { $_.name -eq $binary }

if (-not $asset) {
    Write-Error "Binary not found: ${binary}. Windows may not be supported yet."
    exit 1
}

# Download
Write-Host "> Installing lrn ${version} (windows-${arch})..." -ForegroundColor Green
$tmpFile = Join-Path $env:TEMP $binary
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpFile

# Verify checksum
$checksumAsset = $release.assets | Where-Object { $_.name -eq "checksums.txt" }
if ($checksumAsset) {
    $checksums = Invoke-RestMethod -Uri $checksumAsset.browser_download_url
    $expectedLine = $checksums -split "`n" | Where-Object { $_ -match $binary }
    if ($expectedLine) {
        $expected = ($expectedLine -split "\s+")[0]
        $actual = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash.ToLower()
        if ($expected -ne $actual) {
            Write-Error "Checksum mismatch!"
            exit 1
        }
        Write-Host "> Checksum verified" -ForegroundColor Green
    }
}

# Install
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}
Move-Item -Path $tmpFile -Destination (Join-Path $installDir $binaryName) -Force

# Add to PATH if needed
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*${installDir}*") {
    [Environment]::SetEnvironmentVariable("Path", "${installDir};${userPath}", "User")
    Write-Host "> Added ${installDir} to PATH" -ForegroundColor Green
    Write-Host "  Restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
}

Write-Host "> lrn ${version} installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  lrn --help          Show available commands"
Write-Host "  lrn add stripe      Add a package"
Write-Host "  lrn login           Connect to the registry"
