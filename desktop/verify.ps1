param([Parameter(Mandatory=$true)][string]$Build, [string]$PreviousInstaller)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Build)
$version = (Get-Content (Join-Path (Split-Path $PSScriptRoot) 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $root "FIMI-$version-Windows-x64-Setup.exe"
$target = [IO.Path]::GetFullPath((Join-Path $root 'installation test 中文'))
if (-not $target.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -or (Test-Path -LiteralPath $target)) { throw 'Expected a new build-owned test directory' }
function Run-Checked($file, $arguments) {
  $p = Start-Process -FilePath $file -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "Failed with exit code $($p.ExitCode): $file" }
}
$previousVersion = $null
if ($PreviousInstaller) {
  Run-Checked $PreviousInstaller "/S /TEST /D=$target"
  Run-Checked (Join-Path $target 'WhoIsJSON.exe') '--self-test'
  $previousTest = Get-Content (Join-Path $target 'data/self-test.json') -Raw | ConvertFrom-Json
  if (-not $previousTest.pass) { throw 'Previous installer self-test failed' }
  $previousVersion = $previousTest.version
  [IO.File]::WriteAllText((Join-Path $target 'previous-user-note.txt'), 'preserve-across-version')
}
# NSIS /D must be the final argument, without quotes even when the path contains spaces.
Run-Checked $setup "/S /TEST /D=$target"
$manifest = Get-Content (Join-Path $root 'payload-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.PSObject.Properties) {
  $installed = Join-Path $target $entry.Name
  if ((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "Installed file differs: $($entry.Name)" }
}
if ($PreviousInstaller) {
  if ((Get-Content (Join-Path $target 'previous-user-note.txt') -Raw) -ne 'preserve-across-version') { throw 'Upgrade changed previous user data' }
  if (Test-Path (Join-Path $target 'test-shortcuts/Desktop/Who Is JSON.lnk')) { throw 'Upgrade left the old shortcut' }
}
$setupVersion = (Get-Item -LiteralPath $setup).VersionInfo.FileVersion
if ($setupVersion -ne "$version.0") { throw 'Installer version mismatch' }
$launcherVersion = [Reflection.AssemblyName]::GetAssemblyName((Join-Path $target 'WhoIsJSON.exe')).Version.ToString(3)
if ($launcherVersion -ne $version) { throw 'Launcher version mismatch' }
$signing = Get-Content (Join-Path $root 'signing-status.json') -Raw | ConvertFrom-Json
if ($signing.signed) {
  foreach ($file in @($setup,(Join-Path $target 'WhoIsJSON.exe'),(Join-Path $target 'Uninstall.exe'))) {
    $sig = Get-AuthenticodeSignature -LiteralPath $file
    if ($sig.Status -ne 'Valid' -or -not $sig.TimeStamperCertificate) { throw 'Installed signature invalid' }
  }
}
if (-not ('FimiShortcutTarget' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'ShortcutTarget.cs') }
foreach ($where in @('Desktop','StartMenu')) {
  $shortcutPath = Join-Path $target "test-shortcuts/$where/FIMI.lnk"
  if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) { throw "Missing shortcut: $shortcutPath" }
  $actualTarget = [FimiShortcutTarget]::Read($shortcutPath)
  $expectedTarget = Join-Path $target 'WhoIsJSON.exe'
  if ($actualTarget -ne $expectedTarget) {
    throw ('Incorrect shortcut target: ' + (@{location=$where;expected=$expectedTarget;actual=$actualTarget;actualExists=([bool]$actualTarget -and (Test-Path -LiteralPath $actualTarget -PathType Leaf))} | ConvertTo-Json -Compress))
  }
}
Run-Checked (Join-Path $target 'WhoIsJSON.exe') '--self-test'
$test = Get-Content (Join-Path $target 'data/self-test.json') -Raw | ConvertFrom-Json
if (-not $test.pass -or $test.version -ne $version -or -not $test.cloud.enabled) { throw 'Installed self-test failed' }
$note = Join-Path $target 'user-note.txt'
[IO.File]::WriteAllText($note, 'preserve-user-file')
Run-Checked $setup "/S /TEST /D=$target"
Run-Checked (Join-Path $target 'WhoIsJSON.exe') '--self-test'
if ((Get-Content $note -Raw) -ne 'preserve-user-file') { throw 'Upgrade changed user file' }
Run-Checked (Join-Path $target 'Uninstall.exe') "/S _?=$target"
if (Test-Path (Join-Path $target 'WhoIsJSON.exe')) { throw 'Uninstall left launcher behind' }
if ((Get-Content $note -Raw) -ne 'preserve-user-file' -or -not (Test-Path (Join-Path $target 'data/self-test.json'))) { throw 'Uninstall removed user file or logs' }
if (Test-Path (Join-Path $target 'test-shortcuts/Desktop/FIMI.lnk')) { throw 'Uninstall left shortcut behind' }
@{pass=$true;version=$version;previousVersion=$previousVersion;signatureStatus=$signing.status;installedFiles=@($manifest.PSObject.Properties).Count;selfTest=$test;upgrade=$true;uninstall=$true;userFilesPreserved=$true} | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'installer-verification.json') -Encoding utf8
Write-Output 'Installation, bundled runtime, cloud config, upgrade and safe uninstall passed.'
