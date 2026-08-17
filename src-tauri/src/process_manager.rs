use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct ProcessState {
    pub child: Arc<Mutex<Option<Child>>>,
}

impl ProcessState {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(serde::Serialize, Clone)]
pub struct ProcessStatus {
    pub running: bool,
    pub pid: Option<u32>,
}

pub async fn start_singbox(
    app: AppHandle,
    state: tauri::State<'_, ProcessState>,
    binary_path: String,
    config_json: String,
) -> Result<ProcessStatus, String> {
    let mut child_guard = state.child.lock().await;

    // If already running, stop it first
    if let Some(mut existing) = child_guard.take() {
        let _ = existing.kill().await;
    }

    // Write runtime configuration file
    let config_path = "runtime-singbox-config.json";
    if let Err(e) = tokio::fs::write(config_path, &config_json).await {
        return Err(format!("Failed to write runtime config: {}", e));
    }

    // Resolve binary: custom path, or local ./sing-box.exe
    let resolved_bin = if binary_path.trim().is_empty() {
        if cfg!(windows) {
            "sing-box.exe"
        } else {
            "sing-box"
        }
    } else {
        binary_path.trim()
    };

    let mut cmd = Command::new(resolved_bin);
    cmd.args(["run", "-c", config_path]);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW flag
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to start sing-box binary at '{}': {}. Make sure sing-box is installed or placed in the folder.",
            resolved_bin, e
        )
    })?;

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout logs to frontend
    if let Some(out) = stdout {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(out).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit("singbox-log", line);
            }
        });
    }

    // Stream stderr logs to frontend
    if let Some(err) = stderr {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(err).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit("singbox-log", format!("[ERR] {}", line));
            }
        });
    }

    *child_guard = Some(child);

    Ok(ProcessStatus {
        running: true,
        pid,
    })
}

pub async fn stop_singbox(
    app: AppHandle,
    state: tauri::State<'_, ProcessState>,
) -> Result<ProcessStatus, String> {
    let mut child_guard = state.child.lock().await;
    if let Some(mut child) = child_guard.take() {
        let _ = child.kill().await;
        let _ = app.emit("singbox-log", "[SYSTEM] sing-box process stopped.");
    }

    Ok(ProcessStatus {
        running: false,
        pid: None,
    })
}

pub async fn check_singbox_status(
    state: tauri::State<'_, ProcessState>,
) -> Result<ProcessStatus, String> {
    let child_guard = state.child.lock().await;
    if let Some(child) = child_guard.as_ref() {
        Ok(ProcessStatus {
            running: true,
            pid: child.id(),
        })
    } else {
        Ok(ProcessStatus {
            running: false,
            pid: None,
        })
    }
}
