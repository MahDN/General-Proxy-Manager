mod latency_probe;
mod process_manager;
mod system_proxy;

use latency_probe::{probe_batch_ports, probe_single_port, ProbeResult};
use process_manager::{check_singbox_status, start_singbox, stop_singbox, ProcessState, ProcessStatus};
use tauri::AppHandle;

#[tauri::command]
async fn start_singbox_engine(
    app: AppHandle,
    state: tauri::State<'_, ProcessState>,
    binary_path: String,
    config_json: String,
) -> Result<ProcessStatus, String> {
    start_singbox(app, state, binary_path, config_json).await
}

#[tauri::command]
async fn stop_singbox_engine(
    app: AppHandle,
    state: tauri::State<'_, ProcessState>,
) -> Result<ProcessStatus, String> {
    stop_singbox(app, state).await
}

#[tauri::command]
async fn get_singbox_status(
    state: tauri::State<'_, ProcessState>,
) -> Result<ProcessStatus, String> {
    check_singbox_status(state).await
}

#[tauri::command]
async fn probe_single_proxy(
    port: u16,
    listen_ip: String,
    ping_url: String,
    ip_url: String,
) -> Result<ProbeResult, String> {
    Ok(probe_single_port(port, listen_ip, ping_url, ip_url).await)
}

#[tauri::command]
async fn probe_all_proxies(
    ports: Vec<u16>,
    listen_ip: String,
    ping_url: String,
    ip_url: String,
) -> Result<Vec<ProbeResult>, String> {
    Ok(probe_batch_ports(ports, listen_ip, ping_url, ip_url).await)
}

#[tauri::command]
async fn toggle_system_proxy(enable: bool, host: String, port: u16) -> Result<(), String> {
    #[cfg(windows)]
    {
        system_proxy::set_system_proxy_win(enable, &host, port)
    }
    #[cfg(not(windows))]
    {
        system_proxy::set_system_proxy_unix(enable, &host, port)
    }
}

#[tauri::command]
async fn fetch_subscription(url: String, user_agent: Option<String>) -> Result<String, String> {
    latency_probe::fetch_remote_subscription(url, user_agent).await
}

pub fn run() {
    tauri::Builder::default()
        .manage(ProcessState::new())
        .invoke_handler(tauri::generate_handler![
            start_singbox_engine,
            stop_singbox_engine,
            get_singbox_status,
            probe_single_proxy,
            probe_all_proxies,
            toggle_system_proxy,
            fetch_subscription
        ])
        .run(tauri::generate_context!())
        .expect("error while running General Proxy Manager tauri application");
}
