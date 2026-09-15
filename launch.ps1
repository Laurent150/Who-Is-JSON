$ErrorActionPreference='Stop'
$appRoot=$PSScriptRoot
$port=43127
$url="http://127.0.0.1:$port"
function Open-CodeLingo {
 try {
  $configScript=(Invoke-WebRequest -UseBasicParsing "$url/config.js" -TimeoutSec 3).Content
  $sessionToken=[regex]::Match($configScript,'window.APP_TOKEN="([a-f0-9]+)"').Groups[1].Value
  $null=Invoke-RestMethod "$url/api/widget" -Method Post -Headers @{'X-CodeLingo-Token'=$sessionToken} -ContentType 'application/json' -Body '{}'
 }catch{}
 Start-Process $url
}
try{$health=Invoke-RestMethod "$url/health" -TimeoutSec 1;if($health.app -eq 'CodeLingo'){Open-CodeLingo;exit}}catch{}
$nodeCmd=Get-Command node.exe -ErrorAction SilentlyContinue
$nodePath=if($nodeCmd){$nodeCmd.Source}else{Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('需要 Node.js 20 或更高版本。安装后再次打开。','CodeLingo');exit 1}
if(!(Test-Path -LiteralPath (Join-Path $appRoot 'node_modules/typescript/package.json'))){Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('首次使用源码包，请先按 README 安装依赖，再启动。','CodeLingo');exit 1}
$bundledPython=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if(Test-Path -LiteralPath $bundledPython){$env:CODELINGO_PYTHON=$bundledPython}
$runtime=Join-Path $appRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$p=Start-Process -FilePath $nodePath -ArgumentList @(('"'+(Join-Path $appRoot 'server.js')+'"')) -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'server.log') -RedirectStandardError (Join-Path $runtime 'error.log')
for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 250;try{$health=Invoke-RestMethod "$url/health" -TimeoutSec 1;if($health.app -eq 'CodeLingo'){Open-CodeLingo;exit}}catch{};if($p.HasExited){break}}
Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show('未能启动。请查看 .runtime/error.log，或检查 43127 端口是否被占用。','CodeLingo')
