# install.ps1 — HP-06 Scale Inspector installer for Windows
# Usage: irm https://github.com/mengsokool/scale-inspector/releases/latest/download/install.ps1 | iex

$repo    = "mengsokool/scale-inspector"
$binary  = "scale-inspector.exe"
$dest    = "$env:TEMP\$binary"
$release = "https://github.com/$repo/releases/latest/download/$binary"

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "    HP-06 Scale Inspector installer" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Downloading $binary ..." -ForegroundColor DarkGray

try {
    Invoke-WebRequest -Uri $release -OutFile $dest -UseBasicParsing
    Write-Host "  OK Downloaded to $dest" -ForegroundColor Green
    Write-Host ""
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
