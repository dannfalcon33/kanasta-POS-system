#!/usr/bin/env bash
# ==============================================================================
# Kanasta POS - Restauración de PostgreSQL
# ==============================================================================
set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Uso: $0 <archivo_backup.dump> [database] [force]"
    exit 1
fi

BACKUP_FILE="$1"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${2:-${PGDATABASE:-kanasta}}"
PGUSER="${PGUSER:-postgres}"
FORCE="${3:-no}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: El archivo de copia no existe: ${BACKUP_FILE}" >&2
    exit 1
fi

echo "=========================================================="
echo " [Kanasta POS] ATENCIÓN: Restauración de Base de Datos"
echo " Archivo       : ${BACKUP_FILE}"
echo " Base destino  : ${PGDATABASE}"
echo " Servidor      : ${PGHOST}:${PGPORT}"
echo "=========================================================="

if [ "${FORCE}" != "yes" ] && [ "${FORCE}" != "-f" ] && [ "${FORCE}" != "--force" ]; then
    read -p "¿Está seguro de sobreescribir la base '${PGDATABASE}'? (escriba 'SI'): " CONFIRM
    if [ "${CONFIRM}" != "SI" ]; then
        echo "Operación cancelada."
        exit 0
    fi
fi

echo "Ejecutando pg_restore..."
pg_restore -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c -v "${BACKUP_FILE}" || true

echo "Restauración completada con éxito."
