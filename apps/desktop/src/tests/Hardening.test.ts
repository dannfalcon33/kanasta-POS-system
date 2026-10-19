import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 7: Endurecimiento y Empaquetado Desktop (Tauri 2 & Backup)', () => {
  it('debe contener un archivo de configuración tauri.conf.json válido con políticas CSP estrictas', () => {
    const tauriConfPath = path.resolve(__dirname, '../../src-tauri/tauri.conf.json');
    expect(fs.existsSync(tauriConfPath)).toBe(true);

    const content = fs.readFileSync(tauriConfPath, 'utf-8');
    const config = JSON.parse(content);

    // Identificador y versión de la aplicación
    expect(config.identifier).toBe('com.kanasta.pos');
    expect(config.productName).toBe('Kanasta POS');
    expect(config.version).toBe('1.0.0');

    // Configuración de ventana de escritorio
    const windowConfig = config.app?.windows?.[0];
    expect(windowConfig).toBeDefined();
    expect(windowConfig.title).toContain('Kanasta POS');
    expect(windowConfig.minWidth).toBeGreaterThanOrEqual(1024);
    expect(windowConfig.minHeight).toBeGreaterThanOrEqual(700);
    expect(windowConfig.resizable).toBe(true);

    // Política de seguridad de contenido (CSP) para escritorio
    const csp = config.app?.security?.csp;
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://tauri.localhost');
    expect(csp).toContain('http://localhost:5000');

    // Configuración de empaquetado para Windows (.msi y .exe/nsis)
    const targets = config.bundle?.targets;
    expect(targets).toContain('msi');
    expect(targets).toContain('nsis');
  });

  it('debe contener manifiesto Cargo.toml con tauri 2.0 y soporte nativo', () => {
    const cargoPath = path.resolve(__dirname, '../../src-tauri/Cargo.toml');
    expect(fs.existsSync(cargoPath)).toBe(true);

    const content = fs.readFileSync(cargoPath, 'utf-8');
    expect(content).toContain('name = "kanasta-desktop"');
    expect(content).toContain('edition = "2021"');
    expect(content).toContain('tauri = { version = "2.0"');
    expect(content).toContain('tauri-build = { version = "2.0"');
  });

  it('debe contener punto de entrada Rust lib.rs y main.rs para el ejecutable de Windows', () => {
    const mainRsPath = path.resolve(__dirname, '../../src-tauri/src/main.rs');
    const libRsPath = path.resolve(__dirname, '../../src-tauri/src/lib.rs');

    expect(fs.existsSync(mainRsPath)).toBe(true);
    expect(fs.existsSync(libRsPath)).toBe(true);

    const mainContent = fs.readFileSync(mainRsPath, 'utf-8');
    expect(mainContent).toContain('windows_subsystem = "windows"');
    expect(mainContent).toContain('kanasta_desktop_lib::run()');

    const libContent = fs.readFileSync(libRsPath, 'utf-8');
    expect(libContent).toContain('tauri::Builder::default()');
  });

  it('debe disponer de scripts ejecutables de respaldo y restauración para PostgreSQL y SQLite', () => {
    const scriptsDir = path.resolve(__dirname, '../../../../database/scripts');
    expect(fs.existsSync(scriptsDir)).toBe(true);

    const backupPgPs1 = path.join(scriptsDir, 'backup-postgres.ps1');
    const restorePgPs1 = path.join(scriptsDir, 'restore-postgres.ps1');
    const backupSqlitePs1 = path.join(scriptsDir, 'backup-sqlite.ps1');
    const restoreSqlitePs1 = path.join(scriptsDir, 'restore-sqlite.ps1');

    expect(fs.existsSync(backupPgPs1)).toBe(true);
    expect(fs.existsSync(restorePgPs1)).toBe(true);
    expect(fs.existsSync(backupSqlitePs1)).toBe(true);
    expect(fs.existsSync(restoreSqlitePs1)).toBe(true);

    const backupPgContent = fs.readFileSync(backupPgPs1, 'utf-8');
    expect(backupPgContent).toContain('pg_dump');
    expect(backupPgContent).toContain('RetentionDays');

    const restorePgContent = fs.readFileSync(restorePgPs1, 'utf-8');
    expect(restorePgContent).toContain('pg_restore');
    expect(restorePgContent).toContain('Force');
  });

  it('debe disponer del documento operativo de copias de seguridad BACKUP_AND_RESTORE.md', () => {
    const docPath = path.resolve(__dirname, '../../../../database/BACKUP_AND_RESTORE.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('Recovery Point Objective (RPO)');
    expect(content).toContain('Recovery Time Objective (RTO)');
    expect(content).toContain('Política de Retención');
    expect(content).toContain('pg_dump');
    expect(content).toContain('pg_restore');
  });
});
