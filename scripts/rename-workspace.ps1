# Run from a separate PowerShell after closing tools that use the old checkout.
[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$sourceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ((Split-Path $sourceDirectory -Leaf) -eq 'Rinari-Agent') {
    Write-Output 'The checkout is already named Rinari-Agent.'
    return
}
if ((Split-Path $sourceDirectory -Leaf) -ne 'Rinari-Code') {
    throw 'This helper only renames the explicitly named Rinari-Code checkout.'
}
if (!(Test-Path -LiteralPath (Join-Path $sourceDirectory '.git'))) {
    throw 'The source must be the Git checkout, not a parent directory.'
}
$parentDirectory = Split-Path $sourceDirectory -Parent
$destinationDirectory = [IO.Path]::GetFullPath((Join-Path $parentDirectory 'Rinari-Agent'))
if ((Split-Path $destinationDirectory -Parent) -ne $parentDirectory) {
    throw 'The destination must be a sibling of the source.'
}
if (Test-Path -LiteralPath $destinationDirectory) {
    throw 'Rinari-Agent already exists. No files were moved or merged.'
}
$activeTools = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^(node|cargo|rustc|rinari-code|rinari-agent|makensis)\.exe$' -and
    $_.CommandLine -and $_.CommandLine.Contains($sourceDirectory)
})
if ($activeTools.Count) {
    throw 'Close the development servers, builds and coding tasks using this checkout first. No processes were stopped.'
}
if ($PSCmdlet.ShouldProcess($sourceDirectory, "Rename checkout to $destinationDirectory")) {
    Set-Location -LiteralPath $parentDirectory
    Rename-Item -LiteralPath $sourceDirectory -NewName 'Rinari-Agent'
    Write-Output "Checkout renamed to $destinationDirectory. Reopen that folder in your development tools."
}
