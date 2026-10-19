<#
.SYNOPSIS
    Script de restauración de base de datos PostgreSQL para Kanasta POS.
.DESCRIPTION
    Restaura un archivo de copia de seguridad (.dump) generado por pg_dump (-Fc).
    Incluye confirmación interactiva para evitar sobreescrituras accidentales en producción.
.PARAMETER BackupFile
    Ruta completa o relativa al archivo .dump a restaurar.
.PARAMETER Hostname
    Servidor PostgreSQL (por defecto: localhost o variable PGHOST).
.PARAMETER Port
    Puerto PostgreSQL (por defecto: 5432 o variable PGPORT).
.PARAMETER Database
    Nombre de la base de datos de destino (por defecto: kanasta o variable PGDATABASE).
.PARAMETER Username
    Usuario de conexión (por defecto: postgres o variable PGUSER).
.PARAMETER Force
    Omite la confirmación de seguridad interactiva (útil para pipelines automatizados o simulaciones).
.EXAMPLE
    .\restore-postgres.ps1 -BackupFile C:\KanastaBackups\kanasta_kanasta_20261017.dump -Force
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,

    [string]$Hostname = ($env:PGHOST ?? "localhost"),
    [int]$Port = ($env:PGPORT ?? 5432),
    [string]$Database = ($env:PGDATABASE ?? "kanasta"),
    [string]$Username = ($env:PGUSER ?? "postgres"),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Red
Write-Host " [Kanasta POS] ATENCIÓN: Procedimiento de Restauración" -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red
Write-Host " Archivo de respaldo: $BackupFile"
Write-Host " Base de datos dest : $Database"
Write-Host " Servidor           : ${Hostname}:${Port}"
Write-Host " Usuario            : $Username"
Write-Host " Fecha/Hora         : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "----------------------------------------------------------"

# 1. Validar existencia del archivo
if (-not (Test-Path $BackupFile)) {
    Write-Error "ERROR: El archivo de copia de seguridad no existe en la ruta: $BackupFile"
    exit 1
}

# 2. Confirmación de seguridad
if (-not $Force) {
    Write-Host "ADVERTENCIA: Esta operación sobreescribirá los datos existentes en la base '$Database'." -ForegroundColor Yellow
    $confirmation = Read-Host "¿Está seguro de continuar con la restauración? (escriba 'SI' para confirmar)"
    if ($confirmation -ne "SI") {
        Write-Host "Operación cancelada por el usuario." -ForegroundColor Cyan
        exit 0
    }
}

# 3. Localizar binario pg_restore
$pgRestore = Get-Command "pg_restore" -ErrorAction SilentlyContinue
if (-not $pgRestore) {
    $commonPaths = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" -ErrorAction SilentlyContinue
    if ($commonPaths) {
        $pgRestore = $commonPaths[-1].FullName
    }
}

if ($pgRestore) {
    $restoreExe = if ($pgRestore -is [System.Management.Automation.CommandInfo]) { $pgRestore.Source } else { $pgRestore }
    Write-Host " Ejecutando pg_restore en base de datos $Database..." -ForegroundColor Yellow

    & $restoreExe -h $Hostname -p $Port -U $Username -d $Database -c -v $BackupFile

    if ($LASTEXITCODE -gt 1) {
        Write-Error "ERROR: Falló la restauración con pg_restore. Código de salida: $LASTEXITCODE"
        exit 1
    }
    Write-Host " Base de datos restaurada exitosamente." -ForegroundColor Green
} else {
    Write-Warning "AVISO: No se encontró 'pg_restore' en el PATH del sistema."
    Write-Host "Comando manual equivalente: pg_restore -h $Hostname -p $Port -U $Username -d $Database -c -v `"$BackupFile`"" -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [Kanasta POS] Procedimiento de restauración finalizado." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
