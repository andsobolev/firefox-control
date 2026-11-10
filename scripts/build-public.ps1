[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$releaseRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& node (Join-Path $PSScriptRoot 'validate-public.mjs')
if($LASTEXITCODE -ne 0){throw 'Public package validation failed.'}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$manifest=Get-Content -LiteralPath (Join-Path $releaseRoot 'plugins\firefox-control\plugin.json') -Raw | ConvertFrom-Json
$archiveDirectory=Join-Path $releaseRoot 'dist'
New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
$archivePath=Join-Path $archiveDirectory ('firefox-control-'+$manifest.version+'-windows-candidate.zip')
$files=@(Get-ChildItem -LiteralPath $releaseRoot -Recurse -Force -File | Where-Object {
    $relative=$_.FullName.Substring($releaseRoot.Length+1)
    $relative -notmatch '(^|[\\/])(dist|artifacts|node_modules|\.git)([\\/]|$)' -and $_.Extension -notin @('.zip','.xpi')
})
$stream=[IO.File]::Open($archivePath,[IO.FileMode]::Create)
$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
try {
    foreach($file in $files){
        $relative=$file.FullName.Substring($releaseRoot.Length+1).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {$zip.Dispose();$stream.Dispose()}
$check=[IO.Compression.ZipFile]::OpenRead($archivePath)
try{
    if($check.Entries.Count -ne $files.Count){throw 'Archive entry count mismatch.'}
    foreach($required in @('Install-Windows.ps1','.agents/plugins/marketplace.json','plugins/firefox-control/plugin.json','plugins/firefox-control/server/mcp.mjs','release/STATUS.md')) {
        if(-not $check.GetEntry($required)){throw ('Archive missing '+$required)}
    }
    if(@($check.Entries | Where-Object {$_.FullName -match '(^|/)(loopback\.json|firefox-control-connection\.json|session-.*\.json|local-connection\.js|test-connection\.json|test-options-driver\.js)$'}).Count){throw 'Private file in archive.'}
}finally{$check.Dispose()}
Get-Item -LiteralPath $archivePath | Select-Object Name,Length
$archiveHash=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower()
Write-Output ('SHA256: '+$archiveHash)
Write-Output 'Candidate archive prepared. See release/STATUS.md for outstanding publication items.'
