param(
  [Parameter(Mandatory=$true)][string]$Output,
  [Parameter(Mandatory=$true)][string]$NodeRuntime,
  [Parameter(Mandatory=$true)][string]$PythonRuntime,
  [Parameter(Mandatory=$true)][string]$NodeLicense,
  [Parameter(Mandatory=$true)][string]$MakeNSIS,
  [string]$SigningThumbprint,
  [string]$SignTool,
  [string]$TimestampUrl,
  [switch]$RequireSignature
)
$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot
$version = (Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Expected a three-part release version' }
if ($RequireSignature -and -not $SigningThumbprint) { throw 'A trusted signing identity is required for this build' }
if ($SigningThumbprint -and (-not $SignTool -or -not $TimestampUrl)) { throw 'SignTool and TimestampUrl are required for signing' }
$env:FIMI_SIGN_THUMBPRINT = $SigningThumbprint
$env:FIMI_SIGN_TOOL = $SignTool
$env:FIMI_SIGN_TIMESTAMP = $TimestampUrl
$build = [IO.Path]::GetFullPath($Output)
$env:WHO_NODE_RUNTIME = $NodeRuntime
$env:WHO_PYTHON_RUNTIME = $PythonRuntime
$env:WHO_NODE_LICENSE = $NodeLicense
& (Join-Path $PythonRuntime 'python.exe') (Join-Path $PSScriptRoot 'build-stage.py') --output $build
if ($LASTEXITCODE -ne 0) { throw 'Staging failed' }
$payload = Join-Path $build 'payload'
$assemblyInfo = Join-Path $build 'AssemblyVersion.cs'
[IO.File]::WriteAllText($assemblyInfo, "[assembly: System.Reflection.AssemblyVersion(`"$version.0`")]", [Text.UTF8Encoding]::new($false))
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$(Join-Path $payload who.ico)" "/out:$(Join-Path $payload WhoIsJSON.exe)" (Join-Path $PSScriptRoot 'Launcher.cs') $assemblyInfo
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
if ($SigningThumbprint) { & (Join-Path $PSScriptRoot 'sign.ps1') -Path (Join-Path $payload 'WhoIsJSON.exe') }
& (Join-Path $PythonRuntime 'python.exe') (Join-Path $PSScriptRoot 'inventory.py') $payload
if ($LASTEXITCODE -ne 0) { throw 'Inventory failed' }
$setup = Join-Path $build "FIMI-$version-Windows-x64-Setup.exe"
$signArgs = @()
if ($SigningThumbprint) { $signArgs += "/DSIGN_SCRIPT=$(Join-Path $PSScriptRoot 'sign.ps1')" }
& $MakeNSIS @signArgs "/DAPP_VERSION=$version" /INPUTCHARSET UTF8 "/DPAYLOAD=$payload" "/DREMOVE_LIST=$(Join-Path $build remove-files.nsh)" "/DSETUP_OUT=$setup" (Join-Path $PSScriptRoot 'installer.nsi')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
if ($SigningThumbprint) { & (Join-Path $PSScriptRoot 'sign.ps1') -Path $setup }
$signature = Get-AuthenticodeSignature -LiteralPath $setup
@{signed=($signature.Status -eq 'Valid');status=[string]$signature.Status;version=$version} | ConvertTo-Json | Set-Content (Join-Path $build 'signing-status.json') -Encoding utf8
$hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $build 'SHA256SUMS.txt'), "$hash  $([IO.Path]::GetFileName($setup))`n", [Text.UTF8Encoding]::new($false))
Write-Output $setup
