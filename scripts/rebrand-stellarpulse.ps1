# Rebrand script: replace PULSE -> Stellar Pulse, PULSE -> PULSE, PULSE_token -> pulse_token
# Run from project root. Backs up changed files with .bak
$root = Resolve-Path .
$replacements = @(
    @{from='PULSE'; to='PULSE'},
    @{from='PLSE'; to='PLSE'},
    @{from='PULSE'; to='Stellar Pulse'},
    @{from='stellar-pulse'; to='stellar-pulse'},
    @{from='PULSE'; to='stellarpulse'},
    @{from='PULSE_token'; to='pulse_token'},
    @{from='PULSE-deployer'; to='stellarpulse-deployer'},
    @{from='PULSE-stellar'; to='stellarpulse'},
    @{from='Stellar-PULSE'; to='Stellar-Pulse'}
)
$excludeDirs = @('.git','node_modules','target','.cargo')
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object { $excludeDirs -notcontains $_.Directory.Name }
$changed = 0
foreach($f in $files){
    try{
        $text = Get-Content -Raw -Encoding UTF8 -Path $f.FullName -ErrorAction Stop
    }catch{
        continue
    }
    if($text -match "\x00") { continue } # binary
    $orig = $text
    foreach($r in $replacements){
        $text = $text -replace [regex]::Escape($r.from), $r.to
    }
    if($text -ne $orig){
        Copy-Item -Path $f.FullName -Destination ($f.FullName + ".bak") -Force
        Set-Content -Path $f.FullName -Value $text -Encoding UTF8
        $changed++
        Write-Host "Updated: $($f.FullName)"
    }
}
# Rename contracts/PULSE_token -> contracts/pulse_token if present
$oldDir = Join-Path $root 'contracts\PULSE_token'
$newDir = Join-Path $root 'contracts\pulse_token'
if(Test-Path $oldDir){
    if(Test-Path $newDir){
        Write-Host "Destination $newDir already exists - aborting rename."
    }else{
        Move-Item -Path $oldDir -Destination $newDir
        Write-Host "Renamed directory: $oldDir -> $newDir"
    }
}
# Update Cargo package name inside the moved crate's Cargo.toml
$ctCargo = Join-Path $newDir 'Cargo.toml'
if(Test-Path $ctCargo){
    (Get-Content -Path $ctCargo) -replace 'name\s*=\s*"PULSE_token"','name = "pulse_token"' | Set-Content $ctCargo
    Write-Host "Updated package name in $ctCargo"
}
# Update workspace Cargo.toml members and dependency keys in all Cargo.toml files
$tomls = Get-ChildItem -Path $root -Recurse -File -Filter Cargo.toml
foreach($t in $tomls){
    $ttext = Get-Content -Raw -Encoding UTF8 -Path $t.FullName
    $newt = $ttext -replace 'PULSE_token','pulse_token'
    if($newt -ne $ttext){
        Copy-Item -Path $t.FullName -Destination ($t.FullName + '.bak') -Force
        Set-Content -Path $t.FullName -Value $newt -Encoding UTF8
        Write-Host "Updated Cargo.toml: $($t.FullName)"
        $changed++
    }
}
Write-Host "Rebrand complete. Files changed: $changed"
Write-Host "Note: .bak files created for any modified files. Run 'git status' to review changes."
