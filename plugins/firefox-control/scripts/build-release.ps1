[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$pluginRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest=Get-Content -LiteralPath (Join-Path $pluginRoot 'extension\manifest.json') -Raw | ConvertFrom-Json
$version=$manifest.version
$destination=Join-Path $pluginRoot 'dist'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$extensionFiles=@('manifest.json','background.js','config.js','content.js','icon.svg','local-transport.js','options.html','options.css','options.js','privacy.html','popup.html','popup.css','popup.js')
$sourceFiles=@('README.md','SIGNING.md','MOZILLA_REVIEW_NOTES.txt','VERIFICATION.md','LICENSE','package.json','plugin.json','mcp.json','.mcp.json','.codex-plugin/plugin.json','install.ps1','uninstall.ps1','assets/icon.svg','skills/firefox-control/SKILL.md','scripts/build-release.ps1','scripts/deduplicate-tabs.mjs')
foreach($folder in @('server','tests')){
    $sourceFiles+=@(Get-ChildItem -LiteralPath (Join-Path $pluginRoot $folder) -File -Filter '*.mjs' | ForEach-Object {$folder+'/'+$_.Name})
}
$sourceFiles+=@($extensionFiles | ForEach-Object {'extension/'+$_})
$runtimeConfig=Join-Path $env:LOCALAPPDATA 'FirefoxControl\loopback.json'
$privateToken=$null
if(Test-Path -LiteralPath $runtimeConfig){$privateToken=(Get-Content -LiteralPath $runtimeConfig -Raw | ConvertFrom-Json).token}
function Write-ReleaseZip([string]$target,[string]$base,[string[]]$paths){
    $base=[System.IO.Path]::GetFullPath($base).TrimEnd('\')+'\'
    $stream=[System.IO.File]::Open($target,[System.IO.FileMode]::Create)
    $zip=New-Object System.IO.Compression.ZipArchive($stream,[System.IO.Compression.ZipArchiveMode]::Create,$false)
    try{
        foreach($relative in ($paths | Sort-Object)){
            $file=[System.IO.Path]::GetFullPath((Join-Path $base $relative))
            if(-not $file.StartsWith($base,[System.StringComparison]::OrdinalIgnoreCase)){throw 'Archive path escaped source root.'}
            $text=[System.IO.File]::ReadAllText($file)
            if($privateToken -and $text.Contains($privateToken)){throw ('Private key found in '+$relative)}
            if($text.Contains($env:USERPROFILE) -or $text.Contains($env:USERPROFILE.Replace('\','\\'))){throw ('Personal path found in '+$relative)}
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file,$relative.Replace('\','/'),[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }finally{$zip.Dispose();$stream.Dispose()}
    $check=[System.IO.Compression.ZipFile]::OpenRead($target)
    try{
        if($check.Entries.Count -ne $paths.Count){throw 'Archive entry count mismatch.'}
        if(@($check.Entries | Where-Object {$_.FullName -match '(^|/)(local-connection\.js|loopback\.json|firefox-control-connection\.json|test-options-driver\.js)$'}).Count){throw 'Private or test fixture in release archive.'}
    }finally{$check.Dispose()}
}
$addon=Join-Path $destination ('firefox-control-'+$version+'-unsigned.zip')
$source=Join-Path $destination ('firefox-control-'+$version+'-reviewer-source.zip')
Write-ReleaseZip $addon (Join-Path $pluginRoot 'extension') $extensionFiles
Write-ReleaseZip $source $pluginRoot $sourceFiles
Copy-Item -LiteralPath (Join-Path $pluginRoot 'MOZILLA_REVIEW_NOTES.txt') -Destination $destination -Force
$hashes=@($addon,$source) | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLower()+'  '+[System.IO.Path]::GetFileName($_) }
[System.IO.File]::WriteAllText((Join-Path $destination 'SHA256SUMS.txt'),($hashes -join [Environment]::NewLine)+[Environment]::NewLine,(New-Object System.Text.UTF8Encoding $false))
Get-Item -LiteralPath $addon,$source | Select-Object Name,Length
Write-Output 'Both ZIPs verified: no installation key, personal paths or generated browser test fixtures.'
