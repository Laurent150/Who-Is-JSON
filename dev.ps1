[CmdletBinding()]
param(
    [ValidateSet('Install', 'Start', 'Test', 'Verify')]
    [string]$Task = 'Start',
    [string]$Python = $env:CODELINGO_PYTHON
)

$ErrorActionPreference = 'Stop'
$previousPath = $env:PATH
$previousPython = $env:CODELINGO_PYTHON
$exitCode = 0
Push-Location $PSScriptRoot
try {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $package = Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json
    $pnpmVersion = $package.packageManager -replace '^pnpm@', ''
    $pnpm = Join-Path $PSScriptRoot '.runtime/tools/node_modules/pnpm/bin/pnpm.cjs'
    $nodeVersion = & $node -p 'process.versions.node'
    if ([int]($nodeVersion.Split('.')[0]) -lt 20) {
        throw 'Node.js 20 or newer is required.'
    }

    if ($Task -eq 'Install') {
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        & $npm install --prefix .runtime/tools --no-save --package-lock=false --ignore-scripts "pnpm@$pnpmVersion"
        if ($LASTEXITCODE -ne 0) { throw 'Could not install the pinned pnpm version.' }
    }
    if (!(Test-Path -LiteralPath $pnpm)) {
        throw 'Run ./dev.ps1 -Task Install first to install project-local pnpm and dependencies.'
    }
    $installedVersion = & $node $pnpm --version
    if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $pnpmVersion) {
        throw 'The local pnpm version differs from package.json. Run ./dev.ps1 -Task Install.'
    }

    if ($Task -eq 'Install') {
        & $node $pnpm install --frozen-lockfile --ignore-scripts --store-dir .pnpm-store
        $exitCode = $LASTEXITCODE
    } else {
        $localConfig = Join-Path $PSScriptRoot '.runtime/dev-config.json'
        if (!$Python -and (Test-Path -LiteralPath $localConfig)) {
            $Python = (Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json).python
        }
        if (!$Python) {
            $command = Get-Command python.exe -ErrorAction SilentlyContinue
            if ($command) { $Python = $command.Source }
        }
        if (!$Python -or !(Test-Path -LiteralPath $Python -PathType Leaf)) {
            throw 'Specify a Python 3.12 executable with -Python or CODELINGO_PYTHON.'
        }
        $Python = (Resolve-Path -LiteralPath $Python).Path
        & $Python -c 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 12) else 1)'
        if ($LASTEXITCODE -ne 0) { throw 'Development verification requires Python 3.12 or newer.' }
        $env:CODELINGO_PYTHON = $Python
        # Some historical tests invoke python by name instead of using the setting.
        $env:PATH = (Split-Path -Parent $Python) + [IO.Path]::PathSeparator + $env:PATH
        if ($Task -eq 'Start') {
            & $node $pnpm start
            $exitCode = $LASTEXITCODE
        } else {
            & $node $pnpm test
            $exitCode = $LASTEXITCODE
            if ($Task -eq 'Verify' -and $exitCode -eq 0) {
                & $node $pnpm run test:release
                $exitCode = $LASTEXITCODE
            }
        }
    }
} catch {
    Write-Error $_ -ErrorAction Continue
    $exitCode = 1
} finally {
    $env:PATH = $previousPath
    $env:CODELINGO_PYTHON = $previousPython
    Pop-Location
}
exit $exitCode
