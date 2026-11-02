param([switch]$Execute)
$evidenceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../docs/handoff/evidence'))
$prefix = $evidenceRoot.TrimEnd('\') + '\'
$bytesBefore = (Get-ChildItem -LiteralPath $evidenceRoot -Recurse -File | Measure-Object Length -Sum).Sum
$activeCommands = (Get-CimInstance Win32_Process | Where-Object Name -eq 'electron.exe').CommandLine -join "`n"
if ($Execute -and $activeCommands -match 'tools[/\\]e2e[/\\].+\.cjs') {
  throw 'Dừng các runner Electron trước khi dọn: profile có thể đang dùng dù cửa sổ đã đóng trong lúc dựng video.'
}
$rows = @()
foreach ($dir in Get-ChildItem -LiteralPath $evidenceRoot -Directory -Recurse -Filter 'user-data') {
  $target = [IO.Path]::GetFullPath($dir.FullName)
  if (-not $target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or $dir.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw "Unsafe target: $target" }
  if ($activeCommands.Contains($target)) { continue }
  $sessions = Join-Path $target 'sessions'
  $archive = Join-Path $dir.Parent.FullName 'artifacts/sessions'
  $files = @(if (Test-Path -LiteralPath $sessions) { Get-ChildItem -LiteralPath $sessions -Recurse -File | Where-Object Extension -in @('.json', '.jpg', '.jpeg', '.png', '.mp4') })
  if ($Execute) {
    foreach ($file in $files) {
      $relative = [IO.Path]::GetRelativePath($sessions, $file.FullName)
      $destination = [IO.Path]::GetFullPath((Join-Path $archive $relative))
      if (-not $destination.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe destination: $destination" }
      New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
      Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
      if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $destination).Hash) { throw "Copy verification failed: $relative" }
    }
    # Result/timeline paths remain usable after removing Chromium's profile.
    foreach ($json in Get-ChildItem -LiteralPath $dir.Parent.FullName -Recurse -File -Filter '*.json' | Where-Object { -not $_.FullName.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase) }) {
      $content = [IO.File]::ReadAllText($json.FullName)
      $changed = $content.Replace('user-data\\sessions', 'artifacts\\sessions').Replace('user-data/sessions', 'artifacts/sessions')
      if ($changed -ne $content) { [IO.File]::WriteAllText($json.FullName, $changed, [Text.UTF8Encoding]::new($false)) }
    }
    Remove-Item -LiteralPath $target -Recurse -Force
  }
  $rows += [pscustomobject]@{ path = $target; preservedFiles = $files.Count; deleted = [bool]$Execute }
}
$bytesAfter = (Get-ChildItem -LiteralPath $evidenceRoot -Recurse -File | Measure-Object Length -Sum).Sum
$result = [pscustomobject]@{ at = (Get-Date).ToString('o'); beforeBytes = $bytesBefore; afterBytes = $bytesAfter; savedBytes = $bytesBefore - $bytesAfter; rows = $rows }
if ($Execute) { $result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidenceRoot ('cleanup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')) -Encoding UTF8 }
$result | Select-Object at,beforeBytes,afterBytes,savedBytes,@{Name='profiles';Expression={$rows.Count}} | ConvertTo-Json
