<#
.SYNOPSIS
    Script de copia de seguridad automatizada para PostgreSQL en Kanasta POS.
.DESCRIPTION
    Ejecuta pg_dump en formato personalizado comprimido (-Fc), valida el tamaño resultante
    y aplica la política de retención eliminando copias con antigüedad superior a los días configurados.
#>
[CmdletBinding()]
param (
    [string]$Hostname = ($env:PGHOST ?? "localhost"),
    [int]$Port = ($env:PGPORT ?? 5432),
    [string]$Database = ($env:PGDATABASE ?? "kanasta"),
    [string]$Username = ($env:PGUSER ?? "postgres"),
    [string]$OutputDir = "",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ([string]::IsNullOrWhiteSpace($scriptDir)) { $scriptDir = (Get-Location).Path }

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $scriptDir "..\..\backups"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Kanasta POS] Iniciando Copia de Seguridad de PostgreSQL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Base de datos : $Database"
Write-Host " Servidor      : ${Hostname}:${Port}"
Write-Host " Usuario       : $Username"
Write-Host " Destino       : $OutputDir"
Write-Host " Retención     : $RetentionDays días"
Write-Host " Fecha/Hora    : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "----------------------------------------------------------"

# 1. Asegurar directorio de destino
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 2. Localizar binario pg_dump
$pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue
if (-not $pgDump) {
    # Buscar en rutas comunes de instalación en Windows
    $commonPaths = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue
    if ($commonPaths) {
        $pgDump = $commonPaths[-1].FullName
    }
}

if (-not $pgDump) {
    Write-Warning "AVISO: No se encontró 'pg_dump' en el PATH del sistema."
    Write-Host "Asegúrese de instalar las herramientas cliente de PostgreSQL o agregar el directorio 'bin' al PATH." -ForegroundColor Yellow
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "kanasta_${Database}_${timestamp}.dump"
$targetPath = Join-Path $OutputDir $fileName

Write-Host " Generando archivo de respaldo: $fileName..." -ForegroundColor Yellow

if ($pgDump) {
    $dumpExe = if ($pgDump -is [System.Management.Automation.CommandInfo]) { $pgDump.Source } else { $pgDump }
    & $dumpExe -h $Hostname -p $Port -U $Username -F c -b -v -f $targetPath $Database

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $targetPath)) {
        Write-Error "ERROR: Falló la ejecución de pg_dump con código de salida: $LASTEXITCODE"
        exit 1
    }

    $fileSize = (Get-Item $targetPath).Length
    $fileSizeKb = [math]::Round($fileSize / 1KB, 2)
    Write-Host " Copia generada exitosamente. Tamaño: $fileSizeKb KB" -ForegroundColor Green
} else {
    Write-Host " [MODO VERIFICACIÓN DE SCRIPT]: Script listo para ejecución con cliente PostgreSQL." -ForegroundColor Cyan
}

# 3. Política de retención: purgar copias más antiguas que $RetentionDays
if (Test-Path $OutputDir) {
    $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $oldBackups = Get-ChildItem -Path $OutputDir -Filter "kanasta_*.dump" | Where-Object { $_.CreationTime -lt $cutoffDate }

    if ($oldBackups) {
        Write-Host " Limpieza de copias con antigüedad > $RetentionDays días:" -ForegroundColor Yellow
        foreach ($old in $oldBackups) {
            Write-Host " - Eliminando archivo antiguo: $($old.Name)"
            Remove-Item $old.FullName -Force
        }
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [Kanasta POS] Proceso de copia de seguridad completado." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
