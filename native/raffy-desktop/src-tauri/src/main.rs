// raffy desktop — the web dashboard (tui/web/index.html) in a native window.
//
// Data comes from `bun tui/dash.ts --json`, the same source as the terminal and
// browser views, so the three never disagree. Read-only.
//
//   raffy-desktop          the app
//   raffy-desktop --dump   print what it would show, then exit (CI and tests)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;

fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_default()
}

fn claude_dir() -> PathBuf {
    std::env::var_os("CLAUDE_CONFIG_DIR").map(PathBuf::from).unwrap_or_else(|| home().join(".claude"))
}

fn read_json(p: &Path) -> Option<serde_json::Value> {
    serde_json::from_str(&std::fs::read_to_string(p).ok()?).ok()
}

/// Where raffy lives: $RAFFY_ROOT, else the local marketplace folder, else the installed plugin.
fn raffy_root() -> Option<PathBuf> {
    let has_dash = |p: &Path| p.join("tui").join("dash.ts").is_file();
    if let Some(r) = std::env::var_os("RAFFY_ROOT").map(PathBuf::from) {
        if has_dash(&r) { return Some(r); }
    }
    let plugins = claude_dir().join("plugins");
    if let Some(m) = read_json(&plugins.join("known_marketplaces.json")) {
        if let Some(p) = m.pointer("/raffy-skills/source/path").and_then(|v| v.as_str()).map(PathBuf::from) {
            if has_dash(&p) { return Some(p); }
        }
    }
    if let Some(m) = read_json(&plugins.join("installed_plugins.json")) {
        if let Some(installs) = m.pointer("/plugins/raffy@raffy-skills").and_then(|v| v.as_array()) {
            for i in installs {
                if let Some(p) = i.get("installPath").and_then(|v| v.as_str()).map(PathBuf::from) {
                    if has_dash(&p) { return Some(p); }
                }
            }
        }
    }
    None
}

/// A desktop app does not inherit the shell's PATH, so look where bun is usually installed.
fn bun() -> Option<PathBuf> {
    let exe = if cfg!(windows) { "bun.exe" } else { "bun" };
    let mut candidates = vec![home().join(".bun").join("bin").join(exe)];
    candidates.push(PathBuf::from("/opt/homebrew/bin/bun"));
    candidates.push(PathBuf::from("/usr/local/bin/bun"));
    if let Some(path) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|d| d.join(exe)));
    }
    candidates.into_iter().find(|p| p.is_file())
}

#[tauri::command]
fn projects() -> Result<serde_json::Value, String> {
    let root = raffy_root().ok_or("raffy not found — install the plugin, or set RAFFY_ROOT to the raffy-skills folder")?;
    let bun = bun().ok_or("bun not found — install it from https://bun.sh")?;
    let out = Command::new(bun)
        .arg(root.join("tui").join("dash.ts"))
        .arg("--json")
        .output()
        .map_err(|e| format!("could not run bun: {e}"))?;
    if !out.status.success() {
        return Err(format!("dash.ts failed: {}", String::from_utf8_lossy(&out.stderr).lines().last().unwrap_or("")));
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("unreadable dashboard data: {e}"))
}

fn main() {
    if std::env::args().any(|a| a == "--dump") {
        match projects() {
            Ok(v) => {
                let list = v.as_array().cloned().unwrap_or_default();
                let sessions: usize = list.iter().map(|p| p["sessions"].as_array().map_or(0, |s| s.len())).sum();
                println!("{} projects · {} sessions", list.len(), sessions);
                for p in list.iter().take(5) {
                    println!("  {} · {}", p["name"].as_str().unwrap_or("?"), p["phase"].as_str().unwrap_or("—"));
                }
                std::process::exit(0);
            }
            Err(e) => { eprintln!("error: {e}"); std::process::exit(1); }
        }
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![projects])
        .run(tauri::generate_context!())
        .expect("error while running raffy desktop");
}
