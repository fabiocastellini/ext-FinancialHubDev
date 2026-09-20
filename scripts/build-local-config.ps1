param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [string]$OutputFile = (Join-Path $PSScriptRoot '..\app-config.local.js')
)

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Missing $EnvFile. Copy .env.example to .env, then set FINANCIAL_HUB_WORKER_API_BASE."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $EnvFile) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

  $match = [regex]::Match($trimmed, '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$')
  if (-not $match.Success) { continue }

  $value = $match.Groups[2].Value.Trim()
  if ($value.Length -ge 2 -and (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  $values[$match.Groups[1].Value] = $value
}

$configKeys = [ordered]@{
  APP_ENV = 'FINANCIAL_HUB_APP_ENV'
  SUPABASE_URL = 'FINANCIAL_HUB_SUPABASE_URL'
  SUPABASE_KEY = 'FINANCIAL_HUB_SUPABASE_KEY'
  APP_SECRET = 'FINANCIAL_HUB_APP_SECRET'
  WORKER_API_BASE = 'FINANCIAL_HUB_WORKER_API_BASE'
}

$config = [ordered]@{}
foreach ($configKey in $configKeys.Keys) {
  $envKey = $configKeys[$configKey]
  $value = $values[$envKey]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$envKey is required in .env."
  }
  $config[$configKey] = $value
}

$json = $config | ConvertTo-Json -Compress
$contents = "window.FINANCIAL_HUB_CONFIG = Object.freeze($json);`r`n"
Set-Content -LiteralPath $OutputFile -Value $contents -Encoding utf8 -NoNewline
Write-Host "Created $OutputFile"
