#Requires -Version 5.1
<#
  Empaqueta el Rinari Engine como sidecar portable (ADR 0001, opción 1):
  Python empaquetado + paquete `rinari` instalado vía pip.

  Uso:
    powershell -ExecutionPolicy Bypass -File scripts/package-engine.ps1 `
      -CliRepo C:/Users/Xainner/Documents/DEV/Rinari-CLI `
      -PythonVersion 3.12.11

  Salida: src-tauri/engine-dist/
    python.exe, Lib/site-packages/rinari..., ENGINE_VERSION

  El desktop lo descubre vía resource_dir (ver main.rs: sidecar primero,
  RINARI_ENGINE_BIN/PATH como fallback de desarrollo).
#>
param(
  [string]$CliRepo = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\\Rinari-CLI"),
  [string]$PythonVersion = "3.12.10",
  [string]$OutDir = (Join-Path $PSScriptRoot "..\\src-tauri\\engine-dist")
)

$ErrorActionPreference = "Stop"

$tag = $PythonVersion -replace "\.", ""
$embedUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "rinari-engine-pkg"
New-Item -ItemType Directory -Force -Path $tmp, $OutDir | Out-Null

Write-Host "--> wheel del engine"
$manifest = Get-Content (Join-Path $PSScriptRoot "..\engine-manifest.json") -Raw | ConvertFrom-Json
Push-Location $CliRepo
try {
  $fullSha = (git rev-parse HEAD).Trim()
  if ($fullSha -ne $manifest.engine_git_sha) {
    throw "CLI en $fullSha no coincide con engine-manifest.json ($($manifest.engine_git_sha)). Actualiza el pin o el checkout."
  }
  uv build --wheel
  if ($LASTEXITCODE -ne 0) { throw "uv build falló" }
  $wheel = Get-ChildItem dist/*.whl | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $wheel) { throw "uv build no produjo wheel" }
  $engineSha = (git rev-parse --short HEAD).Trim()
} finally { Pop-Location }

Write-Host "--> python empaquetado $PythonVersion"
$embedZip = Join-Path $tmp "embed.zip"
Invoke-WebRequest -Uri $embedUrl -OutFile $embedZip
Expand-Archive -Path $embedZip -DestinationPath $OutDir -Force

# Habilitar site + pip en el .pth del empaquetado
$pth = Get-ChildItem (Join-Path $OutDir "python*._pth") | Select-Object -First 1
$text = Get-Content $pth.FullName -Raw
$text = $text -replace "#import site", "import site"
$text | Set-Content $pth.FullName -NoNewline

Write-Host "--> pip"
$getPip = Join-Path $tmp "get-pip.py"
Invoke-WebRequest -Uri $getPipUrl -OutFile $getPip
& (Join-Path $OutDir "python.exe") $getPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip falló" }

Write-Host "--> instalar rinari + deps"
& (Join-Path $OutDir "python.exe") -m pip install --no-warn-script-location --upgrade $wheel.FullName
if ($LASTEXITCODE -ne 0) { throw "pip install falló" }

$engineVersion = & (Join-Path $OutDir "python.exe") -m rinari version 2>$null
if ($LASTEXITCODE -ne 0) { $engineVersion = "unknown" }
"rinari=$($engineVersion.Trim())`ncli_sha=$engineSha`npython=$PythonVersion" | Set-Content (Join-Path $OutDir "ENGINE_VERSION")

Write-Host "--> humo: handshake del protocolo"
$hello = @{ id = "pkg-smoke"; method = "engine.info"; params = @{} } | ConvertTo-Json -Compress
$out = $hello | & (Join-Path $OutDir "python.exe") -m rinari engine --stdio 2>$null | Select-Object -First 2
$out | ForEach-Object { Write-Host $_ }
if (-not ($out -match '"ok":\s*true')) { throw "el engine empaquetado no responde engine.info" }
if (-not ($out -match 'desktop_turn_runtime_v3')) { throw "el engine empaquetado no expone desktop_turn_runtime_v3" }

Write-Host "OK: $OutDir"
