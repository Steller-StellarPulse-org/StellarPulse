# Replace 'accent-green' with 'accent-mint' across frontend source files
$root = Resolve-Path .
$files = Get-ChildItem -Path "$root\frontend\src" -Recurse -File -Include *.ts,*.tsx,*.css,*.js
foreach($f in $files){
    $text = Get-Content -Raw -Encoding UTF8 -Path $f.FullName
    $new = $text -replace 'accent-green','accent-mint'
    if($new -ne $text){
        Copy-Item $f.FullName ($f.FullName + '.bak') -Force
        Set-Content -Path $f.FullName -Value $new -Encoding UTF8
        Write-Host "Updated: $($f.FullName)"
    }
}
Write-Host "Done."