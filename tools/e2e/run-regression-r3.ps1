param([int]$AfterProcess = 0, [switch]$SkipAi, [switch]$StartAtOffline)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repoRoot
$env:ELECTRON_RUN_AS_NODE = $null
$env:VINACUT_NO_MAIN_WINDOW = '1'
$electron = Join-Path $repoRoot 'node_modules/electron/dist/electron.exe'
$queuePath = Join-Path $repoRoot ('docs/handoff/evidence/queue-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$rows = @()
if ($AfterProcess) { Write-Output "Chờ runner PID $AfterProcess kết thúc để chạy tuần tự."; Wait-Process -Id $AfterProcess -ErrorAction SilentlyContinue }
function Run-Check([string]$Script) {
  Write-Output "START $Script"
  $started = Get-Date
  $runnerProcess = Start-Process -FilePath $electron -ArgumentList $Script -PassThru -Wait -WindowStyle Hidden
  $script:rows += [pscustomobject]@{ script = $Script; drawing = $env:DWG_PATH; exitCode = $runnerProcess.ExitCode; started = $started.ToString('o'); ended = (Get-Date).ToString('o') }
  $script:rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $queuePath -Encoding UTF8
  Write-Output "END $Script exit=$($runnerProcess.ExitCode)"
}
$taskMutex = [Threading.Mutex]::new($false, 'Local\VinaCutStudioE2E')
try { $null = $taskMutex.WaitOne() } catch [Threading.AbandonedMutexException] { }
try {
if (-not $StartAtOffline) {
  Run-Check 'tools/e2e/check-live-postconditions.cjs'
  Run-Check 'tools/e2e/check-clean-state.cjs'
  Run-Check 'tools/e2e/run-actions.cjs'
}
Run-Check 'tools/e2e/run-plan.cjs'
$env:DWG_PATH = 'C:\Users\taing\Downloads\260629_model-demo-t-corner.dwg'
Run-Check 'tools/e2e/run-real.cjs'
$env:DWG_PATH = 'C:\Users\taing\Downloads\260519_test-bat-diem.dwg'
Run-Check 'tools/e2e/run-real.cjs'
$env:DWG_PATH = $null
if (-not $SkipAi) { Run-Check 'tools/e2e/run-ai.cjs' }
node tools/e2e/check-render-e2e.cjs
$rows += [pscustomobject]@{ script = 'tools/e2e/check-render-e2e.cjs'; exitCode = $LASTEXITCODE }
$rows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $queuePath -Encoding UTF8
$env:VINACUT_AI_KEY = $null
Write-Output "QUEUE FINISHED $queuePath"
if (@($rows | Where-Object { $_.exitCode -ne 0 }).Count) { exit 1 }
exit 0
} finally {
  $taskMutex.ReleaseMutex()
  $taskMutex.Dispose()
}
