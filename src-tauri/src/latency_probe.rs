use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProbeResult {
    pub port: u16,
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub http_status: Option<u16>,
    pub egress_ip: Option<String>,
    pub error: Option<String>,
}

pub async fn probe_single_port(
    port: u16,
    listen_ip: String,
    ping_url: String,
    ip_url: String,
) -> ProbeResult {
    let proxy_str = format!("http://{}:{}", listen_ip, port);
    let proxy = match reqwest::Proxy::all(&proxy_str) {
        Ok(p) => p,
        Err(e) => {
            return ProbeResult {
                port,
                success: false,
                latency_ms: None,
                http_status: None,
                egress_ip: None,
                error: Some(format!("Invalid proxy config: {}", e)),
            };
        }
    };

    let client = match reqwest::Client::builder()
        .proxy(proxy)
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return ProbeResult {
                port,
                success: false,
                latency_ms: None,
                http_status: None,
                egress_ip: None,
                error: Some(format!("Client build error: {}", e)),
            };
        }
    };

    // Measure Ping Latency
    let start = Instant::now();
    let resp = client.get(&ping_url).send().await;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    match resp {
        Ok(response) => {
            let status = response.status().as_u16();

            // Fetch IP in background
            let mut detected_ip = None;
            if let Ok(ip_resp) = client.get(&ip_url).send().await {
                if let Ok(text) = ip_resp.text().await {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(ip_str) = json_val.get("ip").and_then(|v| v.as_str()) {
                            detected_ip = Some(ip_str.to_string());
                        }
                    }
                    if detected_ip.is_none() {
                        detected_ip = Some(text.trim().to_string());
                    }
                }
            }

            ProbeResult {
                port,
                success: true,
                latency_ms: Some(elapsed_ms),
                http_status: Some(status),
                egress_ip: detected_ip,
                error: None,
            }
        }
        Err(e) => ProbeResult {
            port,
            success: false,
            latency_ms: None,
            http_status: None,
            egress_ip: None,
            error: Some(e.to_string()),
        },
    }
}

pub async fn probe_batch_ports(
    ports: Vec<u16>,
    listen_ip: String,
    ping_url: String,
    ip_url: String,
) -> Vec<ProbeResult> {
    let mut tasks = Vec::new();
    for port in ports {
        let ip_clone = listen_ip.clone();
        let ping_clone = ping_url.clone();
        let ip_url_clone = ip_url.clone();
        tasks.push(tokio::spawn(async move {
            probe_single_port(port, ip_clone, ping_clone, ip_url_clone).await
        }));
    }

    let mut results = Vec::new();
    for task in tasks {
        if let Ok(res) = task.await {
            results.push(res);
        }
    }
    results
}

pub async fn fetch_remote_subscription(url: String, user_agent: Option<String>) -> Result<String, String> {
    let ua = user_agent.unwrap_or_else(|| "v2rayN/6.23 (Windows NT 10.0; Win64; x64)".to_string());
    let client = reqwest::Client::builder()
        .user_agent(ua)
        .timeout(Duration::from_secs(15))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let resp = client.get(&url).send().await.map_err(|e| format!("HTTP request error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Subscription server returned HTTP {}", resp.status()));
    }
    let text = resp.text().await.map_err(|e| format!("Failed to read body: {}", e))?;
    Ok(text)
}
