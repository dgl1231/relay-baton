$ErrorActionPreference = "Stop"

$Repo = if ($env:RELAY_BATON_REPO) { $env:RELAY_BATON_REPO } else { "dgl1231/relay-baton" }
$InstallDir = if ($env:RELAY_BATON_INSTALL_DIR) { $env:RELAY_BATON_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\relay-baton" }
$Asset = "relay-baton-windows-x64.exe"
$Base = "https://github.com/$Repo/releases/latest/download"
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("relay-baton-install-" + [System.Guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Force -Path $Tmp, $InstallDir | Out-Null
try {
  Write-Host "Downloading $Asset from $Repo latest release..."
  $Bin = Join-Path $Tmp $Asset
  $Sums = Join-Path $Tmp "SHA256SUMS"
  Invoke-WebRequest -Uri "$Base/$Asset" -OutFile $Bin
  Invoke-WebRequest -Uri "$Base/SHA256SUMS" -OutFile $Sums

  $Line = Get-Content $Sums | Where-Object { $_ -match "\s+$([regex]::Escape($Asset))$" } | Select-Object -First 1
  if (-not $Line) {
    throw "SHA256SUMS does not contain $Asset"
  }
  $Expected = ($Line -split "\s+")[0].ToLowerInvariant()
  $Actual = (Get-FileHash -Algorithm SHA256 $Bin).Hash.ToLowerInvariant()
  if ($Expected -ne $Actual) {
    throw "checksum mismatch for $Asset"
  }

  $Target = Join-Path $InstallDir "relay-baton.exe"
  Move-Item -Force -Path $Bin -Destination $Target
  Write-Host "Installed relay-baton to $Target"

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $Parts = @()
  if ($UserPath) { $Parts = $UserPath -split ";" }
  if ($Parts -notcontains $InstallDir) {
    [Environment]::SetEnvironmentVariable("Path", (($Parts + $InstallDir) -join ";"), "User")
    Write-Host "Added $InstallDir to the user PATH. Open a new terminal to use relay-baton globally."
  }
  Write-Host "Next: relay-baton --version"
}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
