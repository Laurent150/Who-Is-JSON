param([Parameter(Mandatory=$true)][string]$Build)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Build)
$version = (Get-Content (Join-Path (Split-Path $PSScriptRoot) 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $root "Who-Is-JSON-$version-Windows-x64-Setup.exe"
$target = [IO.Path]::GetFullPath((Join-Path $root 'installation test'))
if (-not $target.StartsWith($root + [IO.Path]::DirectorySeparatorChar) -or (Test-Path -LiteralPath $target)) { throw 'Expected a new build-owned test directory' }
function Run-Checked($file, $arguments) {
  $p = Start-Process -FilePath $file -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "Failed with exit code $($p.ExitCode): $file" }
}
# NSIS /D must be the final argument, without quotes even when the path contains spaces.
Run-Checked $setup "/S /TEST /D=$target"
$manifest = Get-Content (Join-Path $root 'payload-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.PSObject.Properties) {
  $installed = Join-Path $target $entry.Name
  if ((Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "Installed file differs: $($entry.Name)" }
}
$shell = New-Object -ComObject WScript.Shell
foreach ($where in @('Desktop','StartMenu')) {
  $shortcut = $shell.CreateShortcut((Join-Path $target "test-shortcuts/$where/Who Is JSON.lnk"))
  if ($shortcut.TargetPath -ne (Join-Path $target 'WhoIsJSON.exe')) { throw 'Incorrect shortcut target' }
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
if (Test-Path (Join-Path $target 'test-shortcuts/Desktop/Who Is JSON.lnk')) { throw 'Uninstall left shortcut behind' }
@{pass=$true;version=$version;installedFiles=@($manifest.PSObject.Properties).Count;selfTest=$test;upgrade=$true;uninstall=$true;userFilesPreserved=$true} | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'installer-verification.json') -Encoding utf8
Write-Output 'Installation, bundled runtime, cloud config, upgrade and safe uninstall passed.'
