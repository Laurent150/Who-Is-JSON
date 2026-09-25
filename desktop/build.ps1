param(
  [Parameter(Mandatory=$true)][string]$Output,
  [Parameter(Mandatory=$true)][string]$NodeRuntime,
  [Parameter(Mandatory=$true)][string]$PythonRuntime,
  [Parameter(Mandatory=$true)][string]$NodeLicense,
  [Parameter(Mandatory=$true)][string]$MakeNSIS
)
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot
$version = (Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json).version
$build = [IO.Path]::GetFullPath($Output)
$env:WHO_NODE_RUNTIME = $NodeRuntime
$env:WHO_PYTHON_RUNTIME = $PythonRuntime
$env:WHO_NODE_LICENSE = $NodeLicense
& (Join-Path $PythonRuntime 'python.exe') (Join-Path $PSScriptRoot 'build-stage.py') --output $build
if ($LASTEXITCODE -ne 0) { throw 'Staging failed' }
$payload = Join-Path $build 'payload'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$(Join-Path $payload who.ico)" "/out:$(Join-Path $payload WhoIsJSON.exe)" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
& (Join-Path $PythonRuntime 'python.exe') (Join-Path $PSScriptRoot 'inventory.py') $payload
if ($LASTEXITCODE -ne 0) { throw 'Inventory failed' }
$setup = Join-Path $build "Who-Is-JSON-$version-Windows-x64-Setup.exe"
& $MakeNSIS /INPUTCHARSET UTF8 "/DPAYLOAD=$payload" "/DREMOVE_LIST=$(Join-Path $build remove-files.nsh)" "/DSETUP_OUT=$setup" (Join-Path $PSScriptRoot 'installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
$hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $build 'SHA256SUMS.txt'), "$hash  $([IO.Path]::GetFileName($setup))`n", [Text.UTF8Encoding]::new($false))
Write-Output $setup
