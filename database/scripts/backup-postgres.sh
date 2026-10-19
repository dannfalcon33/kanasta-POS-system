#!/usr/bin/env bash
# ==============================================================================
# Kanasta POS - Copia de seguridad automatizada de PostgreSQL
# ==============================================================================
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-kanasta}"
PGUSER="${PGUSER:-postgres}"
OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${2:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${OUTPUT_DIR}/kanasta_${PGDATABASE}_${TIMESTAMP}.dump"

echo "=========================================================="
echo " [Kanasta POS] Iniciando Copia de Seguridad PostgreSQL"
echo " Base de datos : ${PGDATABASE}"
echo " Servidor      : ${PGHOST}:${PGPORT}"
echo " Destino       : ${BACKUP_FILE}"
echo " Retención     : ${RETENTION_DAYS} días"
echo "=========================================================="

mkdir -p "${OUTPUT_DIR}"

pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -F c -b -v -f "${BACKUP_FILE}" "${PGDATABASE}"

if [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERROR: El archivo de copia está vacío o no se generó." >&2
    exit 1
fi

echo "Copia generada exitosamente. Tamaño: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Política de retención
find "${OUTPUT_DIR}" -name "kanasta_${PGDATABASE}_*.dump" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
echo "Copias con antigüedad superior a ${RETENTION_DAYS} días eliminadas."
echo "Proceso finalizado con éxito."
