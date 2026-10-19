<#
.SYNOPSIS
    Script de respaldo para entornos SQLite de Kanasta POS (Desarrollo / Monocaja).
.DESCRIPTION
    Realiza una copia segura del archivo .db verificando su integridad y aplicando política de retención.
#>
[CmdletBinding()]
param (
    [string]$SourceDb = "",
    [string]$OutputDir = "",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrWhiteSpace($scriptDir)) { $scriptDir = (Get-Location).Path }

if ([string]::IsNullOrWhiteSpace($SourceDb)) {
    $resolved = Join-Path $scriptDir "..\..\services\api\Kanasta.Api\kanasta_dev.db"
    if (Test-Path $resolved) {
        $SourceDb = (Resolve-Path $resolved).Path
    } else {
        $SourceDb = Join-Path (Get-Location).Path "services\api\Kanasta.Api\kanasta_dev.db"
    }
}

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $scriptDir "..\..\backups"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Kanasta POS] Respaldo de Base de Datos SQLite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Origen    : $SourceDb"
Write-Host " Destino   : $OutputDir"
Write-Host " Retención : $RetentionDays días"

if (-not (Test-Path $SourceDb)) {
    Write-Error "ERROR: La base de datos SQLite no existe en: $SourceDb"
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetFile = Join-Path $OutputDir "kanasta_sqlite_${timestamp}.db"

# Copia de seguridad atómica del archivo de datos
Copy-Item -Path $SourceDb -Destination $targetFile -Force

# Copiar también archivos WAL y SHM si existen
$walFile = "$SourceDb-wal"
$shmFile = "$SourceDb-shm"
if (Test-Path $walFile) {
    Copy-Item -Path $walFile -Destination "$targetFile-wal" -Force
}
if (Test-Path $shmFile) {
    Copy-Item -Path $shmFile -Destination "$targetFile-shm" -Force
}

$fileSizeKb = [math]::Round((Get-Item $targetFile).Length / 1KB, 2)
Write-Host " Respaldo generado: $targetFile ($fileSizeKb KB)" -ForegroundColor Green

# Política de retención
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $OutputDir -Filter "kanasta_sqlite_*.db" | Where-Object { $_.CreationTime -lt $cutoffDate } | ForEach-Object {
    Write-Host " Eliminando respaldo obsoleto: $($_.Name)" -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Write-Host " Respaldo SQLite completado con éxito." -ForegroundColor Green
exit 0
