param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
$thumbprint = $env:FIMI_SIGN_THUMBPRINT
if ($thumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Expected a code-signing certificate thumbprint' }
if (-not (Test-Path -LiteralPath $env:FIMI_SIGN_TOOL)) { throw 'SignTool is unavailable' }
if ($env:FIMI_SIGN_TIMESTAMP -notmatch '^https?://') { throw 'An RFC3161 timestamp service is required' }
$certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$thumbprint"
if (-not $certificate.HasPrivateKey -or $certificate.NotAfter -lt (Get-Date)) { throw 'Signing certificate is unusable' }
& $env:FIMI_SIGN_TOOL sign /sha1 $thumbprint /s My /fd SHA256 /tr $env:FIMI_SIGN_TIMESTAMP /td SHA256 $Path
if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
& $env:FIMI_SIGN_TOOL verify /pa /all $Path
if ($LASTEXITCODE -ne 0) { throw 'Signature verification failed' }
$signature = Get-AuthenticodeSignature -LiteralPath $Path
if ($signature.Status -ne 'Valid' -or -not $signature.TimeStamperCertificate) { throw 'A valid timestamped signature is required' }
