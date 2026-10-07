// raffy desktop — the dashboard page (tui/web/index.html) in a native window,
// with a tray icon and a few actions the browser view does not get.
//
// Every read and every action goes through raffy's own bun scripts, so the
// terminal, browser and desktop views never disagree. The page can only ask
// for names on the allowlists below — never an arbitrary command.
//
//   raffy-desktop          the app
//   raffy-desktop --dump   print what it would show, then exit (CI and tests)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

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

/// Run one of raffy's scripts with fixed arguments; returns stdout.
fn run_script(script: &str, args: &[&str], cwd: &Path) -> Result<String, String> {
    let root = raffy_root().ok_or("raffy not found — install the plugin, or set RAFFY_ROOT to the raffy-skills folder")?;
    let bun = bun().ok_or("bun not found — install it from https://bun.sh")?;
    let out = Command::new(bun)
        .arg(root.join(script))
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("could not run bun: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err.lines().filter(|l| !l.trim().is_empty()).last().unwrap_or("").to_string();
        return Err(if msg.is_empty() { String::from_utf8_lossy(&out.stdout).trim().to_string() } else { msg });
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn json(s: &str) -> Result<serde_json::Value, String> {
    serde_json::from_str(s).map_err(|e| format!("unreadable data: {e}"))
}

/// Reads. The page names what it wants; this table decides what that runs.
fn read(query: &str) -> Result<serde_json::Value, String> {
    let h = home();
    match query {
        "projects" => json(&run_script("tui/dash.ts", &["--json"], &h)?),
        "sessions" => json(&run_script("tui/sessions.ts", &["--json"], &h)?),
        "skills" => json(&run_script("skills/guide/scripts/catalog.ts", &["list", "--json"], &h)?),
        "drill" => json(&run_script("skills/drill/scripts/ledger.ts", &["json"], &h)?),
        "budget" => json(&run_script("skills/doctor/scripts/doctor.ts", &["budget", ".", "--json"], &h)?),
        // Same table as QUERIES in tui/web.ts — keep them in step.
        other => Err(format!("unknown query: {other}")),
    }
}

fn valid_skill(id: &str) -> bool {
    !id.is_empty() && id.len() < 120 && id.chars().all(|c| c.is_ascii_alphanumeric() || "-_.:".contains(c))
}

/// A project folder the dashboard showed: an existing directory inside the home folder.
fn valid_dir(p: &str) -> Option<PathBuf> {
    let path = plain(PathBuf::from(p).canonicalize().ok()?);
    (path.is_dir() && path.starts_with(plain(home().canonicalize().ok()?))).then_some(path)
}

/// On Windows, canonicalize returns `\\?\C:\…`, which cmd cannot `cd` into. Drop the
/// prefix for drive paths; leave UNC paths alone.
fn plain(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy().into_owned();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => PathBuf::from(rest),
        _ => p,
    }
}

// The commands run off the main thread: a slow script must not freeze the window or tray.
#[tauri::command]
async fn raffy(query: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || read(&query)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn act(action: String, arg: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || change(&action, &arg)).await.map_err(|e| e.to_string())?
}

/// Whether the tray icon exists. Without one, closing the window must quit, or the app
/// would keep running with no way back to it.
struct Tray(AtomicBool);

/// A path as one shell word. Single quotes: nothing inside expands, not even `$(…)`.
fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

fn open_terminal(dir: &Path, run_claude: bool) -> Result<(), String> {
    let d = dir.to_string_lossy().to_string();
    let spawn = |c: &mut Command| c.spawn().map(|_| ()).map_err(|e| e.to_string());
    let shell = format!("cd {}{}", sh_quote(&d), if run_claude { " && claude" } else { "" });
    if cfg!(target_os = "macos") {
        // The shell command goes inside an AppleScript string: escape for that second.
        let script = format!("tell application \"Terminal\" to do script \"{}\"", shell.replace('\\', "\\\\").replace('"', "\\\""));
        spawn(Command::new("osascript").args(["-e", &script, "-e", "tell application \"Terminal\" to activate"]))
    } else if cfg!(windows) {
        // cmd has no safe quoting for every character; refuse the ones it would interpret.
        if d.chars().any(|c| "\"&|<>^%!".contains(c)) { return Err("folder name has characters cmd would run".into()); }
        let inner = if run_claude { format!("cd /d \"{d}\" && claude") } else { format!("cd /d \"{d}\"") };
        spawn(Command::new("cmd").args(["/c", "start", "cmd", "/k", &inner]))
    } else {
        let inner = format!("{shell}; exec bash");
        spawn(Command::new("x-terminal-emulator").args(["-e", "bash", "-lc", &inner]))
            .or_else(|_| spawn(Command::new("gnome-terminal").args(["--", "bash", "-lc", &inner])))
    }
}

/// Changes. The page asks the user first; this side validates every argument.
fn change(action: &str, arg: &str) -> Result<String, String> {
    let h = home();
    match action {
        "unlink" if valid_skill(arg) => run_script("skills/doctor/scripts/doctor.ts", &["unlink", arg, "--yes"], &h),
        "enable" if valid_skill(arg) => run_script("skills/guide/scripts/catalog.ts", &["enable", arg, "--yes"], &h),
        "terminal" | "claude" | "reveal" => {
            let dir = valid_dir(arg).ok_or("not a project folder inside your home directory")?;
            match action {
                "terminal" => open_terminal(&dir, false).map(|_| "opened a terminal".into()),
                "claude" => open_terminal(&dir, true).map(|_| "started Claude Code".into()),
                _ => {
                    let opener = if cfg!(target_os = "macos") { "open" } else if cfg!(windows) { "explorer" } else { "xdg-open" };
                    Command::new(opener).arg(&dir).spawn().map(|_| "opened the folder".into()).map_err(|e| e.to_string())
                }
            }
        }
        _ => Err(format!("refused: {action} {arg}")),
    }
}

fn main() {
    if std::env::args().any(|a| a == "--dump") {
        match read("projects") {
            Ok(v) => {
                let list = v.as_array().cloned().unwrap_or_default();
                let sessions: usize = list.iter().map(|p| p["sessions"].as_array().map_or(0, |s| s.len())).sum();
                println!("{} projects · {} sessions", list.len(), sessions);
                for p in list.iter().take(5) {
                    println!("  {} · {}", p["name"].as_str().unwrap_or("?"), p["phase"].as_str().unwrap_or("—"));
                }
                // Every other read the page makes must work too, or a tab shows an error.
                let mut failed = false;
                for q in ["sessions", "skills", "drill", "budget"] {
                    match read(q) {
                        Ok(_) => println!("{q}: ok"),
                        Err(e) => { failed = true; eprintln!("{q}: {e}"); }
                    }
                }
                std::process::exit(if failed { 1 } else { 0 });
            }
            Err(e) => { eprintln!("error: {e}"); std::process::exit(1); }
        }
    }
    tauri::Builder::default()
        .manage(Tray(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![raffy, act])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show raffy", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Refresh", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &refresh, &quit])?;
            let reveal = |app: &tauri::AppHandle| {
                if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
            };
            let tray = TrayIconBuilder::with_id("raffy")
                .icon(app.default_window_icon().cloned().ok_or("no app icon")?)
                .tooltip("raffy")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, e| match e.id.as_ref() {
                    "show" => reveal(app),
                    "refresh" => { let _ = app.emit("raffy://refresh", ()); }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(move |tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = e { reveal(tray.app_handle()); }
                })
                .build(app);
            match tray {
                Ok(_) => app.state::<Tray>().0.store(true, Ordering::Relaxed),
                Err(e) => eprintln!("no tray icon ({e}); closing the window quits"),
            }
            Ok(())
        })
        .on_window_event(|window, e| {
            // With a tray, closing the window keeps raffy there (Quit is in the tray menu).
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                if window.state::<Tray>().0.load(Ordering::Relaxed) { let _ = window.hide(); api.prevent_close(); }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running raffy desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quoting_stops_expansion() {
        assert_eq!(sh_quote("/a b"), "'/a b'");
        assert_eq!(sh_quote("/x/$(rm -rf ~)"), "'/x/$(rm -rf ~)'");
        assert_eq!(sh_quote("it's"), "'it'\\''s'");
    }

    #[test]
    fn skill_ids_are_plain() {
        assert!(valid_skill("raffy:guide"));
        assert!(valid_skill("marketing-ideas"));
        assert!(!valid_skill(""));
        assert!(!valid_skill("x; rm -rf ~"));
        assert!(!valid_skill("../../etc"));
    }

    #[test]
    fn windows_prefix_dropped_for_drives_only() {
        assert_eq!(plain(PathBuf::from(r"\\?\C:\Users\a")), PathBuf::from(r"C:\Users\a"));
        assert_eq!(plain(PathBuf::from(r"\\?\UNC\srv\share")), PathBuf::from(r"\\?\UNC\srv\share"));
        assert_eq!(plain(PathBuf::from("/home/a")), PathBuf::from("/home/a"));
    }

    #[test]
    fn folders_stay_inside_home() {
        assert!(valid_dir(&home().to_string_lossy()).is_some());
        assert!(valid_dir("/etc").is_none());
        assert!(valid_dir(&format!("{}/../..", home().to_string_lossy())).is_none());
        assert!(valid_dir("/definitely/not/here").is_none());
    }

    #[test]
    fn unknown_reads_and_actions_are_refused() {
        assert!(read("rm").is_err());
        assert!(change("shell", "ls").is_err());
        assert!(change("enable", "a b").is_err());
    }
}
