// relay-baton desktop shell.
//
// Intentionally thin: it only opens a window, enables the shell plugin so the
// webview can invoke the bundled `relay-baton` CLI as a sidecar, and persists
// window size/position across launches. The updater plugin is wired for
// opt-in, confirmation-first update checks from the webview. No business logic
// lives here — everything stays in packages/core via the CLI.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Remember window size/position between launches (Phase D).
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running relay-baton desktop");
}
