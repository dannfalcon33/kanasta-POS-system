#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // Setup hooks, desktop window configuration and local native integrations
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
