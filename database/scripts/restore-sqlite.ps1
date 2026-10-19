<#
.SYNOPSIS
    Script de restauración de base de datos SQLite para Kanasta POS.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    [string]$TargetDb = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrWhiteSpace($scriptDir)) { $scriptDir = (Get-Location).Path }

if ([string]::IsNullOrWhiteSpace($TargetDb)) {
    $resolved = Join-Path $scriptDir "..\..\services\api\Kanasta.Api\kanasta_dev.db"
    if (Test-Path $resolved) {
        $TargetDb = (Resolve-Path $resolved).Path
    } else {
        $TargetDb = Join-Path (Get-Location).Path "services\api\Kanasta.Api\kanasta_dev.db"
    }
}

Write-Host "==========================================================" -ForegroundColor Red
Write-Host " [Kanasta POS] Restauración de Base de Datos SQLite" -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host " Respaldo origen : $BackupFile"
Write-Host " Destino actual  : $TargetDb"

if (-not (Test-Path $BackupFile)) {
    Write-Error "ERROR: El archivo de respaldo no existe: $BackupFile"
    exit 1
}

if (-not $Force) {
    Write-Host "ADVERTENCIA: Esta acción sobreescribirá la base SQLite actual." -ForegroundColor Yellow
    $confirm = Read-Host "¿Confirmar restauración? (escriba 'SI')"
    if ($confirm -ne "SI") {
        Write-Host "Operación cancelada." -ForegroundColor Cyan
        exit 0
    }
}

Copy-Item -Path $BackupFile -Destination $TargetDb -Force

# Restaurar WAL si existe
$backupWal = "$BackupFile-wal"
if (Test-Path $backupWal) {
    Copy-Item -Path $backupWal -Destination "$TargetDb-wal" -Force
} else {
    if (Test-Path "$TargetDb-wal") { Remove-Item "$TargetDb-wal" -Force }
}

Write-Host " Base de datos SQLite restaurada exitosamente." -ForegroundColor Green
exit 0
