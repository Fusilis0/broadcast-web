# Broadcast Web Studio launcher — starts Vite if needed, then Electron.
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Broadcast Web Studio'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repo

$studioUrl = 'http://127.0.0.1:5173/?race=demo-istanbul&outputMode=transparent'
$electronCmd = Join-Path $repo 'desktop\node_modules\.bin\electron.cmd'

function Test-PortListen([int]$Port) {
  try {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $c
  } catch {
    return $false
  }
}

function Test-ViteReady {
  foreach ($uri in @(
      'http://127.0.0.1:5173',
      'http://localhost:5173'
    )) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 2
      if ($r.StatusCode -ge 200) { return $true }
    } catch {
      # try next
    }
  }
  return $false
}

Write-Host "Repo: $repo"

if (-not (Test-Path $electronCmd)) {
  Write-Host 'Installing desktop dependencies...'
  npm install --prefix desktop
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm install --prefix desktop failed.'
    Read-Host 'Press Enter to close'
    exit 1
  }
}

if (-not (Test-ViteReady)) {
  Write-Host 'Starting Vite dev server...'
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/k', 'npm run dev' `
    -WorkingDirectory $repo `
    -WindowStyle Normal

  Write-Host 'Waiting for http://127.0.0.1:5173 ...'
  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-ViteReady) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    Write-Host 'Vite did not become ready. Check the Vite window for errors.'
    Read-Host 'Press Enter to close'
    exit 1
  }
  Write-Host 'Vite is ready.'
} else {
  Write-Host 'Vite already running.'
}

Write-Host "Opening Electron → $studioUrl"
$env:BROADCAST_WEB_URL = $studioUrl
Set-Location (Join-Path $repo 'desktop')

# Run Electron in this console so errors stay visible.
& $electronCmd . --dev
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host "Electron exited with code $code"
  Read-Host 'Press Enter to close'
}
exit $code
