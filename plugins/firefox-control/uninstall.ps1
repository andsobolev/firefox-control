$taskConfigPath = Join-Path $env:LOCALAPPDATA 'FirefoxControl\loopback.json'
if (Test-Path -LiteralPath $taskConfigPath) {
    try {
        $taskConfig = Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
        $taskHeaders = @{ Authorization = ('Bearer ' + $taskConfig.token) }
        Invoke-RestMethod -Uri ('http://127.0.0.1:' + $taskConfig.port + '/shutdown') -Method Post -Headers $taskHeaders -TimeoutSec 3 | Out-Null
    } catch { }
}
$ErrorActionPreference = 'Stop'
$registryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\local.codex.firefox_control'
$manifestPath = Join-Path $env:LOCALAPPDATA 'FirefoxControl\local.codex.firefox_control.json'
if ((Test-Path -LiteralPath $registryPath) -and (Get-Item -LiteralPath $registryPath).GetValue('') -eq $manifestPath) {
    Remove-Item -LiteralPath $registryPath
    Write-Output 'Firefox native host disconnected.'
}
Write-Output 'Remove Firefox Control Bridge in about:addons and uninstall Firefox Control from Codex Plugins. Source files are preserved.'
