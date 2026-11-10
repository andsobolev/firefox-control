[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
if([Environment]::OSVersion.Platform -ne 'Win32NT'){throw 'This installer supports Windows only.'}

$packageRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$sourceRoot=Join-Path $packageRoot 'plugins\firefox-control'
$manifest=Get-Content -LiteralPath (Join-Path $sourceRoot 'plugin.json') -Raw | ConvertFrom-Json
if($manifest.name -ne 'firefox-control'){throw 'Invalid Firefox Control package.'}
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
if(-not $nodeCommand){throw 'Install Node.js 22 or newer from https://nodejs.org/ and reopen PowerShell.'}
$nodePath=$nodeCommand.Source
$nodeMajor=& $nodePath -p 'Number(process.versions.node.split(".")[0])'
if($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 22){throw 'Node.js 22 or newer is required.'}

$codexCommand=Get-Command codex -ErrorAction SilentlyContinue
$codexPath=if($codexCommand){$codexCommand.Source}else{$null}
if(-not $codexPath){
    $codexBin=Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    if(Test-Path -LiteralPath $codexBin){
        $candidate=Get-ChildItem -LiteralPath $codexBin -Directory |
            ForEach-Object {Get-Item -LiteralPath (Join-Path $_.FullName 'codex.exe') -ErrorAction SilentlyContinue} |
            Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
        if($candidate){$codexPath=$candidate.FullName}
    }
}
if(-not $codexPath){throw 'Install Codex desktop or the Codex CLI, then reopen PowerShell.'}
$pluginHelp=& $codexPath plugin add --help 2>&1
if($LASTEXITCODE -ne 0){throw 'This Codex installation does not support plugin installation. Update Codex first.'}

$destinationParent=[IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.codex\plugins'))
$destination=[IO.Path]::GetFullPath((Join-Path $destinationParent 'firefox-control'))
if(-not $destination.StartsWith($destinationParent.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){
    throw 'Invalid installation destination.'
}
$required=@('plugin.json','mcp.json','.mcp.json','.codex-plugin\plugin.json','extension\manifest.json','server\mcp.mjs','install.ps1')
foreach($relative in $required){if(-not (Test-Path -LiteralPath (Join-Path $sourceRoot $relative) -PathType Leaf)){throw ('Missing package file: '+$relative)}}
if(Test-Path -LiteralPath $destination){
    $oldManifest=Join-Path $destination 'plugin.json'
    if(-not (Test-Path -LiteralPath $oldManifest)){throw 'The destination already exists and is not an identified Firefox Control installation.'}
    $old=Get-Content -LiteralPath $oldManifest -Raw | ConvertFrom-Json
    if($old.name -ne 'firefox-control'){throw 'Another plugin occupies the destination.'}
}
Write-Output ('Firefox Control '+$manifest.version)
Write-Output ('Source: '+$sourceRoot)
Write-Output ('Destination: '+$destination)
Write-Output ('Node: '+$nodePath)
Write-Output ('Codex: '+$codexPath)
if($CheckOnly){Write-Output 'Prerequisites and package verified. No changes made.';return}

# Refuse junctions/symlinks inside the source or destination before copying.
foreach($directory in @($sourceRoot,$destinationParent,$destination)){
    if(Test-Path -LiteralPath $directory){
        $entry=Get-Item -LiteralPath $directory -Force
        if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Installation directories must not be junctions or symbolic links.'}
    }
}
if(@(Get-ChildItem -LiteralPath $sourceRoot -Force -Recurse | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}).Count){throw 'Package contains a symbolic link.'}
New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
if(Test-Path -LiteralPath $destination){
    if(@(Get-ChildItem -LiteralPath $destination -Force -Recurse | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}).Count){throw 'Existing installation contains a symbolic link.'}
    $backupRoot=Join-Path $env:LOCALAPPDATA 'FirefoxControl\source-backups'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupPath=Join-Path $backupRoot ('firefox-control-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
    Copy-Item -LiteralPath $destination -Destination $backupPath -Recurse
    Write-Output ('Previous source backed up: '+$backupPath)
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach($entry in Get-ChildItem -LiteralPath $sourceRoot -Force){Copy-Item -LiteralPath $entry.FullName -Destination $destination -Recurse -Force}
foreach($sourceFile in Get-ChildItem -LiteralPath $sourceRoot -File -Force -Recurse){
    $relative=$sourceFile.FullName.Substring($sourceRoot.Length).TrimStart('\')
    $installedFile=Join-Path $destination $relative
    if((Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $installedFile -Algorithm SHA256).Hash){throw ('Copy verification failed: '+$relative)}
}
& (Join-Path $destination 'install.ps1') -RegisterMarketplace
if(-not $?){throw 'Local bridge setup failed.'}
$catalogFile=Join-Path $env:USERPROFILE '.agents\plugins\marketplace.json'
$catalog=Get-Content -LiteralPath $catalogFile -Raw | ConvertFrom-Json
& $codexPath plugin add ('firefox-control@'+$catalog.name)
if($LASTEXITCODE -ne 0){throw 'Codex plugin installation failed.'}
Write-Output ''
Write-Output 'Local plugin installed. Install the Mozilla-signed Firefox extension, then import:'
Write-Output (Join-Path $env:LOCALAPPDATA 'FirefoxControl\firefox-control-connection.json')
Write-Output 'Create pairing separately on each computer. Do not copy or share that connection file.'
Write-Output 'Restart Codex once, then ask it to check Firefox connection.'
