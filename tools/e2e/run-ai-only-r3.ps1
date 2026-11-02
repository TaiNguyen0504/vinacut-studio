$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repoRoot
if (-not $env:VINACUT_AI_KEY) { throw 'Đặt VINACUT_AI_KEY trong terminal này trước khi chạy.' }
$env:ELECTRON_RUN_AS_NODE = $null
$env:VINACUT_NO_MAIN_WINDOW = '1'
$env:VINACUT_AI_PROVIDER = 'Google'
$env:VINACUT_AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
$env:VINACUT_AI_MODEL = 'gemini-3.5-flash-lite'
$env:AI_CASES = $null
$taskMutex = [Threading.Mutex]::new($false, 'Local\VinaCutStudioE2E')
Write-Output 'Chờ các lượt hồi quy đang chạy kết thúc rồi mới chạy AI để tránh thiếu bộ nhớ.'
try { $null = $taskMutex.WaitOne() } catch [Threading.AbandonedMutexException] { }
try {
  $runner = Start-Process -FilePath (Join-Path $repoRoot 'node_modules/electron/dist/electron.exe') -ArgumentList 'tools/e2e/run-ai.cjs' -WindowStyle Hidden -Wait -PassThru
  exit $runner.ExitCode
} finally {
  $taskMutex.ReleaseMutex()
  $taskMutex.Dispose()
}
