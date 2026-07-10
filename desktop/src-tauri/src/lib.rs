// relay-baton desktop shell.
//
// Intentionally thin: it only opens a window, enables the shell plugin so the
// webview can invoke the bundled `relay-baton` CLI as a sidecar, and persists
// window size/position across launches. The updater plugin is wired for
// opt-in, confirmation-first update checks from the webview. No business logic
// lives here — everything stays in packages/core via the CLI.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();

    // The release workflow injects `plugins.updater` into tauri.conf.json only
    // when updater signing secrets exist. Registering the updater plugin
    // without that config makes plugin init fail with
    // `PluginInitialization("updater", ... expected struct Config)` — the app
    // panicked before ever opening a window (found by the first real MSI
    // install, v1.3.0). Only register it when the config block is present.
    let has_updater_config = context.config().plugins.0.contains_key("updater");

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init());
    if has_updater_config {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        // Remember window size/position between launches (Phase D).
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(context)
        .expect("error while running relay-baton desktop");
}
