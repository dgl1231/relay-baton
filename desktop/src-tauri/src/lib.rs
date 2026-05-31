// relay-baton desktop shell.
//
// Intentionally thin: it only opens a window and enables the shell plugin so
// the webview can invoke the bundled `relay-baton` CLI as a sidecar. No
// business logic lives here — everything stays in packages/core via the CLI.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running relay-baton desktop");
}
