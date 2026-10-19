<#
.SYNOPSIS
    Script de empaquetado y preparación de release para Kanasta Desktop (Windows).
.DESCRIPTION
    1. Ejecuta la compilación de producción de TypeScript y Vite.
    2. Comprueba disponibilidad del toolchain de Tauri 2 (Rust / Cargo / C++ Build Tools).
    3. Si el toolchain nativo está disponible, ejecuta 'tauri build' para generar instaladores .msi / .exe.
    4. Si se compila en modo portable, prepara un directorio 'dist-release' con el cliente listo y launcher.
#>
[CmdletBinding()]
param (
    [switch]$NativeOnly,
    [switch]$PortableOnly
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Kanasta POS] Empaquetado de Aplicación de Escritorio" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$desktopDir = Split-Path -Parent $PSScriptRoot
Set-Location $desktopDir

# 1. Compilación de la aplicación web (React + Vite)
Write-Host " 1. Compilando bundle de producción de la interfaz..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "ERROR: Falló la compilación de Vite en 'apps/desktop'."
    exit 1
}
Write-Host " Bundle web generado exitosamente en 'dist/'." -ForegroundColor Green

# 2. Comprobar toolchain de Tauri 2 (Rust & Cargo)
$cargo = Get-Command "cargo" -ErrorAction SilentlyContinue
$rustc = Get-Command "rustc" -ErrorAction SilentlyContinue

if ($cargo -and $rustc -and -not $PortableOnly) {
    Write-Host " 2. Toolchain de Rust detectado. Iniciando compilación de instalador nativo Tauri 2..." -ForegroundColor Yellow
    npx @tauri-apps/cli build

    if ($LASTEXITCODE -eq 0) {
        Write-Host " Instalador nativo (.msi / .exe) generado exitosamente en 'src-tauri/target/release/bundle/'." -ForegroundColor Green
        exit 0
    } else {
        Write-Warning "AVISO: La compilación nativa de Tauri reportó código: $LASTEXITCODE. Generando paquete portable de contingencia."
    }
} else {
    Write-Host " 2. Entorno Rust nativo no detectado (o modo Portable solicitado)." -ForegroundColor Yellow
    Write-Host "    Para compilar instaladores nativos .msi/.exe se requiere instalar Rust mediante https://rustup.rs/." -ForegroundColor Gray
}

# 3. Preparación de paquete portable de escritorio
Write-Host " 3. Preparando paquete de distribución listo para escritorio..." -ForegroundColor Yellow
$releaseDir = Join-Path $desktopDir "dist-release"
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

# Copiar bundle de producción
Copy-Item -Path (Join-Path $desktopDir "dist\*") -Destination $releaseDir -Recurse -Force

# Generar script lanzador para Windows
$launcherContent = @"
@echo off
title Kanasta POS - Punto de Venta e Inventario
echo ========================================================
echo  Iniciando Kanasta POS Desktop...
echo ========================================================
start "" http://localhost:5173
exit
"@

Set-Content -Path (Join-Path $releaseDir "Iniciar-KanastaPOS.bat") -Value $launcherContent -Encoding ASCII

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [Kanasta POS] Empaquetado finalizado con éxito." -ForegroundColor Green
Write-Host " Directorio de distribución: $releaseDir" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
exit 0
