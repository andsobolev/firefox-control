[CmdletBinding()]
param([switch]$RegisterMarketplace)
$ErrorActionPreference = 'Stop'
$pluginRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$nodePath = (Get-Command node -ErrorAction Stop).Source
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'FirefoxControl'
$manifestPath = Join-Path $runtimeRoot 'local.codex.firefox_control.json'
$registryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\local.codex.firefox_control'
if (Test-Path -LiteralPath $registryPath) {
    $existingPath = (Get-Item -LiteralPath $registryPath).GetValue('')
    if ($existingPath -and $existingPath -ne $manifestPath) {
        throw "A different native host already uses this name: $existingPath"
    }
}
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false
$launcherPath = Join-Path $runtimeRoot 'native-host-v2.bat'
$hostScript = Join-Path $pluginRoot 'server\native-host.mjs'
foreach ($part in @($nodePath, $hostScript)) {
    if ($part.Contains('"') -or $part.Contains('%') -or $part.Contains([char]10) -or $part.Contains([char]13)) {
        throw 'Native host path contains unsupported batch characters.'
    }
}
$launcher = '@echo off' + [Environment]::NewLine + '"' + $nodePath + '" "' + $hostScript + '"' + [Environment]::NewLine
[System.IO.File]::WriteAllText($launcherPath, $launcher, $utf8)
$extensionManifest = Get-Content -LiteralPath (Join-Path $pluginRoot 'extension\manifest.json') -Raw | ConvertFrom-Json
$manifest = @{
    name = 'local.codex.firefox_control'
    description = 'Local Firefox Control native bridge'
    path = $launcherPath
    type = 'stdio'
    allowed_extensions = @($extensionManifest.browser_specific_settings.gecko.id)
} | ConvertTo-Json
[System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8)
New-Item -Path $registryPath -Force | Out-Null
Set-Item -LiteralPath $registryPath -Value $manifestPath
if ($RegisterMarketplace) {
    $catalogDir = Join-Path $env:USERPROFILE '.agents\plugins'
    $catalogPath = Join-Path $catalogDir 'marketplace.json'
    $userRoot = [System.IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\') + '\'
    if (-not $pluginRoot.StartsWith($userRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Personal marketplace registration requires the plugin inside your user directory.'
    }
    $relative = './' + $pluginRoot.Substring($userRoot.Length).Replace('\','/')
    $entry = [pscustomobject]@{
        name = 'firefox-control'
        source = @{ source = 'local'; path = $relative }
        policy = @{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
        category = 'Productivity'
    }
    if (Test-Path -LiteralPath $catalogPath) {
        $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
        if (-not $catalog.name -or $null -eq $catalog.plugins) { throw 'Existing marketplace is not a supported catalog.' }
        $old = @($catalog.plugins | Where-Object name -eq 'firefox-control')
        if ($old.Count -and $old[0].source.path -ne $relative) { throw 'A different Firefox Control plugin is already registered.' }
        $catalog.plugins = @($catalog.plugins | Where-Object name -ne 'firefox-control') + @($entry)
        Copy-Item -LiteralPath $catalogPath -Destination ($catalogPath + '.firefox-backup') -Force
    } else {
        $catalog = [pscustomobject]@{ name = 'personal-local'; interface = @{ displayName = 'Personal local plugins' }; plugins = @($entry) }
    }
    New-Item -ItemType Directory -Path $catalogDir -Force | Out-Null
    [System.IO.File]::WriteAllText($catalogPath, ($catalog | ConvertTo-Json -Depth 15), $utf8)
    Write-Output ("Marketplace: " + $catalog.name)
}
Write-Output ("Native host registered: " + $manifestPath)
Write-Output ("Firefox add-on manifest: " + (Join-Path $pluginRoot 'extension\manifest.json'))

& $nodePath (Join-Path $pluginRoot 'server\setup-loopback.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Local bridge configuration failed.' }
