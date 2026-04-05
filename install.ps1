# install.ps1 — HP-06 Scale Inspector installer for Windows
# Usage: irm https://github.com/mengsokool/scale-inspector/releases/latest/download/install.ps1 | iex

$repo    = "mengsokool/scale-inspector"
$binary  = "scale-inspector.exe"
$baseDir = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($baseDir)) {
    $baseDir = $env:TEMP
}
$installDir = Join-Path $baseDir "scale-inspector"
$dest    = Join-Path $installDir $binary
$versionFile = Join-Path $installDir "version.txt"
$release = if ($env:SCALE_INSPECTOR_RELEASE_URL) { $env:SCALE_INSPECTOR_RELEASE_URL } else { "https://github.com/$repo/releases/latest/download/$binary" }
$releaseApi = if ($env:SCALE_INSPECTOR_RELEASE_API_URL) { $env:SCALE_INSPECTOR_RELEASE_API_URL } else { "https://api.github.com/repos/$repo/releases/latest" }
$webOptions = @{}
if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
    $webOptions.UseBasicParsing = $true
}

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "    HP-06 Scale Inspector installer" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Target: $dest" -ForegroundColor DarkGray
Write-Host ""

try {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null

    $installedVersion = $null
    if ((Test-Path $dest) -and (Test-Path $versionFile)) {
        $installedVersion = (Get-Content -Path $versionFile -Raw).Trim()
    }

    $latestVersion = $null
    try {
        $releaseInfo = Invoke-RestMethod -Uri $releaseApi @webOptions
        $latestVersion = "$($releaseInfo.tag_name)".TrimStart("v")
    } catch {
        $latestVersion = $null
    }

    if ($latestVersion) {
        Write-Host "  Latest: $latestVersion" -ForegroundColor DarkGray
        Write-Host ""
    }

    if ($latestVersion -and ($installedVersion -eq $latestVersion)) {
        Write-Host "  OK Already up to date ($latestVersion)" -ForegroundColor Green
        Write-Host "  Reusing installed binary" -ForegroundColor DarkGray
        Write-Host ""
    } elseif ((Test-Path $dest) -and (-not $latestVersion)) {
        Write-Host "  WARN Could not check GitHub version right now" -ForegroundColor Yellow
        Write-Host "  Reusing installed binary" -ForegroundColor DarkGray
        Write-Host ""
    } else {
        $tmp = Join-Path $installDir "$binary.download"
        if ($latestVersion) {
            Write-Host "  Downloading version $latestVersion ..." -ForegroundColor DarkGray
        } else {
            Write-Host "  Downloading latest release ..." -ForegroundColor DarkGray
        }
        Invoke-WebRequest -Uri $release -OutFile $tmp @webOptions
        Move-Item -Force -Path $tmp -Destination $dest
        if ($latestVersion) {
            Set-Content -Path $versionFile -Value $latestVersion -NoNewline
        } elseif (Test-Path $versionFile) {
            Remove-Item -Force $versionFile
        }
        Write-Host "  OK Installed to $dest" -ForegroundColor Green
        Write-Host ""
    }

    Write-Host "  Starting scale inspector..." -ForegroundColor DarkGray
    Write-Host ""
    & $dest @args
} catch {
    Write-Host "  ERROR Failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Try downloading manually from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/$repo/releases/latest" -ForegroundColor Yellow
    exit 1
}
