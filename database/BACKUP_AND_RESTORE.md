# Procedimientos de Copia de Seguridad y Restauración (Kanasta POS)

Este documento describe la arquitectura operativa, las herramientas y los protocolos obligatorios para garantizar la durabilidad de los datos transaccionales, auditoría y catálogos de **Kanasta POS**.

---

## 1. Arquitectura de Respaldo y Objetivos Operativos

Para un negocio retail (abastos y supermercados), los incidentes de pérdida de datos interrumpen la facturación y comprometen el control fiscal y de inventario. Kanasta establece los siguientes objetivos:

- **Recovery Point Objective (RPO):** < 15 minutos en horario comercial (frecuencia de copias o replicación WAL).
- **Recovery Time Objective (RTO):** < 45 minutos para restauración completa del servicio ante caída catastrófica de hardware.
- **Tipos de Copias:**
  1. **Copias Completas Diarias:** Snapshot íntegro de la base de datos al cierre de operaciones de cada jornada.
  2. **Copias Intradía (Opcional):** Respaldo de mediodía o retención de archivos WAL de PostgreSQL.

---

## 2. Política de Retención (Regla 7-4-12)

Para optimizar el uso de disco y asegurar trazabilidad histórica:

| Nivel | Frecuencia | Retención | Ubicación |
|---|---|---|---|
| **Diario** | Todos los días al cierre de turno | 7 días | Disco local / Directorio `backups/` |
| **Semanal** | Cada domingo a medianoche | 4 semanas | Servidor secundario o almacenamiento en red (NAS) |
| **Mensual** | Último día del mes | 12 meses | Almacenamiento externo desconectado / Nube segura |

---

## 3. Procedimiento para PostgreSQL (Producción Multicaja)

### 3.1 Generación de Copia de Seguridad

El script automatizado ejecuta `pg_dump` utilizando el formato personalizado comprimido (`-F c`), el cual permite compresión integrada, verificación de checksums y restauración selectiva de tablas si fuera necesario.

#### En Windows (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/backup-postgres.ps1 -Database kanasta -OutputDir C:\KanastaBackups -RetentionDays 7
```

#### En Linux / Servidor Docker (Bash):
```bash
./database/scripts/backup-postgres.sh /var/backups/kanasta 7
```

### 3.2 Procedimiento de Restauración

El procedimiento de restauración utiliza internamente la utilidad `pg_restore` de PostgreSQL para reconstruir las tablas, índices, secuencias y datos desde el archivo `.dump` comprimido.

> [!CAUTION]
> La restauración sobreescribe los datos existentes en la base de datos de destino. Ejecute este paso únicamente durante mantenimientos programados o recuperación de desastres.

#### En Windows (PowerShell):
```powershell
# Modo interactivo (solicita confirmación manual 'SI')
powershell -ExecutionPolicy Bypass -File database/scripts/restore-postgres.ps1 -BackupFile C:\KanastaBackups\kanasta_kanasta_20261017_200000.dump

# Modo forzado (sin confirmación, para scripts de contingencia)
powershell -ExecutionPolicy Bypass -File database/scripts/restore-postgres.ps1 -BackupFile C:\KanastaBackups\kanasta_kanasta_20261017_200000.dump -Force
```

#### En Linux (Bash):
```bash
./database/scripts/restore-postgres.sh /var/backups/kanasta/kanasta_kanasta_20261017_200000.dump kanasta
```

---

## 4. Procedimiento para SQLite (Monocaja / Evaluación / Desarrollo)

Para despliegues simplificados de una sola estación física donde se utiliza SQLite:

### 4.1 Generación de Copia de Seguridad
```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/backup-sqlite.ps1 -RetentionDays 7
```
El script genera una copia consistente del archivo `.db` y preserva los registros WAL (`-wal`) y de memoria compartida (`-shm`) si la base se encuentra en modo transaccional activo.

### 4.2 Restauración de SQLite
```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/restore-sqlite.ps1 -BackupFile .\backups\kanasta_sqlite_20261017_201415.db -Force
```

---

## 5. Automatización mediante Tareas Programadas

### 5.1 Programador de Tareas de Windows (Task Scheduler)
Para ejecutar la copia diaria a las 23:00 de forma automática:
1. Abrir `taskschd.msc`.
2. Crear Tarea Básica: `"Kanasta POS - Respaldo Diario"`.
3. Desencadenador: Diariamente a las 23:00.
4. Acción: Iniciar un programa:
   - **Programa o script:** `powershell.exe`
   - **Argumentos:** `-NoProfile -ExecutionPolicy Bypass -File "C:\Kanasta\database\scripts\backup-postgres.ps1"`
   - **Iniciar en:** `C:\Kanasta`
5. Configurar: "Ejecutar tanto si el usuario inició sesión como si no".

### 5.2 Linux Crontab
Agregar la siguiente entrada con `crontab -e`:
```cron
# Copia de seguridad diaria de Kanasta a las 23:00
0 23 * * * /opt/kanasta/database/scripts/backup-postgres.sh /var/backups/kanasta 7 >> /var/log/kanasta_backup.log 2>&1
```

---

## 6. Protocolo de Verificación Periódica de Integridad (Simulación de Restauración)

Una copia de seguridad no verificada se considera inexistente. Mensualmente, el administrador debe ejecutar el siguiente protocolo de prueba:

1. **Restaurar en entorno aislado:** Restaurar la última copia en una base de datos de pruebas (ej. `kanasta_test_restore`).
2. **Consulta de integridad y balance:**
   ```sql
   -- 1. Verificar conteo de productos
   SELECT count(*) FROM products;
   
   -- 2. Verificar últimas 10 ventas registradas
   SELECT id, sale_number, total, created_at FROM sales ORDER BY created_at DESC LIMIT 10;
   
   -- 3. Verificar consistencia del Kardex y movimientos de stock
   SELECT count(*) FROM stock_movements;
   ```
3. **Comprobación de usuarios y sesiones:** Comprobar que los usuarios administradores y cajeros pueden autenticarse correctamente con sus credenciales habituales.
4. **Registro de bitácora:** Documentar la fecha, tamaño del dump y resultado de la prueba en la bitácora técnica del negocio.
