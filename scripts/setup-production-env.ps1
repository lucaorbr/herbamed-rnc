if (Test-Path ".env") {
  Write-Host ".env ja existe. Nada foi alterado."
  exit 0
}

function New-Secret {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

$postgresPassword = New-Secret
$jwtSecret = New-Secret
$arecoPassword = if ($env:ARECO_SQLSERVER_PASSWORD) { $env:ARECO_SQLSERVER_PASSWORD } else { "" }

@"
POSTGRES_DB=sgqherbamed
POSTGRES_USER=sgqherbamed
POSTGRES_PASSWORD=$postgresPassword

JWT_SECRET=$jwtSecret
INITIAL_ADMIN_EMAIL=admin
INITIAL_ADMIN_PASSWORD=Herba@123
INITIAL_ADMIN_NAME=Administrador SGQ

ANTHROPIC_API_KEY=

FILE_UPLOAD_MAX_BYTES=52428800
JSON_BODY_LIMIT_BYTES=80000000
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30

ARECO_SYNC_ENABLED=true
ARECO_SYNC_INTERVAL_MS=180000
ARECO_RECEBIMENTOS_LIMIT=1000
ARECO_RECEBIMENTOS_DAYS=7
ARECO_FORNECEDORES_LIMIT=5000
ARECO_FORNECEDORES_YEARS=5
ARECO_SQLSERVER_HOST=10.0.242.230
ARECO_SQLSERVER_PORT=5327
ARECO_SQLSERVER_DATABASE=VSatHerbamed
ARECO_SQLSERVER_USER=fabiano.alves
ARECO_SQLSERVER_PASSWORD=$arecoPassword

ARECO_RECEBIMENTOS_QUERY=
ARECO_MATERIAIS_QUERY=
ARECO_MATERIAIS_LIMIT=0
"@ | Set-Content -Path ".env" -Encoding UTF8

Write-Host ".env criado com POSTGRES_PASSWORD e JWT_SECRET fortes."
if (-not $arecoPassword) {
  Write-Host "Aviso: ARECO_SQLSERVER_PASSWORD ficou vazio. Preencha no .env para ativar a sincronizacao com o Areco."
}
