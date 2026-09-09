# JEJU ISLAND RAID — One-click download + live preview (Windows PowerShell)
$ErrorActionPreference = "Stop"
$dest    = Join-Path $env:USERPROFILE "Desktop\Jeju-Island-Raid"
$zipPath = Join-Path $env:TEMP "Jeju-Island-Raid.zip"
$zipUrl  = "https://github.com/Akbar120/jenny-os/archive/refs/tags/jeju-raid-v1.zip"
$port    = 8080

Write-Host ""
Write-Host "  JEJU ISLAND RAID  -  Solo Leveling" -ForegroundColor Magenta
Write-Host ""

Write-Host "[1/4] Downloading..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
Write-Host "      Done ($([math]::Round((Get-Item $zipPath).Length/1KB)) KB)" -ForegroundColor Green

Write-Host "[2/4] Extracting to Desktop\Jeju-Island-Raid ..." -ForegroundColor Cyan
Get-ChildItem $dest -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zipPath -DestinationPath $dest -Force

$playFile = Get-ChildItem $dest -Recurse -Filter "jeju-island-raid-PLAY.html" | Select-Object -First 1
$indexFile = Get-ChildItem $dest -Recurse -Directory | Where-Object { $_.Name -eq "jeju-island-raid" } | ForEach-Object {
  Get-ChildItem $_.FullName -Filter "index.html" -ErrorAction SilentlyContinue
} | Select-Object -First 1

if (-not $playFile -and -not $indexFile) { throw "Game files not found in $dest" }
$gameDir = if ($playFile) { $playFile.Directory.FullName } else { $indexFile.Directory.FullName }
Write-Host "      $gameDir" -ForegroundColor Green

Write-Host "[3/4] Opening game..." -ForegroundColor Cyan
if ($playFile) { Start-Process $playFile.FullName }

Write-Host "[4/4] Live preview http://localhost:$port" -ForegroundColor Cyan
Set-Location $gameDir
$py = $null
foreach ($c in @("py","python","python3")) {
  if (Get-Command $c -ErrorAction SilentlyContinue) { $py = $c; break }
}
if ($py) {
  Start-Process "http://localhost:$port"
  Write-Host ""
  Write-Host "  LIVE PREVIEW →  http://localhost:$port" -ForegroundColor Yellow
  Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
  Write-Host ""
  & $py -m http.server $port
} else {
  Write-Host "  Python not found — single-file game already opened." -ForegroundColor Yellow
  Write-Host "  Folder: $gameDir" -ForegroundColor Yellow
  explorer $gameDir
}
