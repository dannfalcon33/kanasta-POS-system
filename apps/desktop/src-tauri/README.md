# Runtime Nativo de Escritorio (Tauri 2)

Esta carpeta alojará la configuración del backend nativo de Tauri 2 (`tauri.conf.json`, `Cargo.toml`, `src/main.rs`).

## Requisitos de Construcción Nativa
1. **Rust y Cargo:** Instalar mediante `rustup` (https://rustup.rs/).
2. **C++ Build Tools:** Requerido en Windows (Visual Studio Build Tools con C++ desktop workload).

El desarrollo de la interfaz de usuario se realiza con React + Vite (`npm run dev`). La compilación al ejecutable de escritorio `.msi` / `.exe` se integra formalmente en la **Fase 7**.
