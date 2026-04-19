
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Manager;

mod go_client;
mod mihomo;
mod ml_server;

use go_client::{ExtraKeySpec, GoClientConfig, GoClientManager};
use mihomo::MihomoManager;
use ml_server::MlServerManager;

static ML_ENDPOINT: std::sync::LazyLock<Mutex<String>> =
    std::sync::LazyLock::new(|| Mutex::new(String::new()));

static EXTRA_KEY_COUNT: std::sync::LazyLock<Mutex<usize>> =
    std::sync::LazyLock::new(|| Mutex::new(0));


#[derive(Debug, Clone, Serialize, Deserialize)]
struct RoutingRule {
    id: String,
    kind: String,
    value: String,
    action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    conn_key: String,
    auto_connect: bool,
    theme: String,
    mihomo_port: u16,
    socks_addr: String,
    kill_switch: bool,
    #[serde(default)]
    dns_redirect: bool,
    #[serde(default = "default_true")]
    ipv6: bool,
    #[serde(default = "default_tun")]
    tun_stack: String,
    #[serde(default = "default_true")]
    hwid: bool,
    #[serde(default = "default_true")]
    auth_tip: bool,
    #[serde(default)]
    secret: String,
    #[serde(default)]
    routing_rules: Vec<RoutingRule>,
    #[serde(default)]
    blocklist: Vec<RoutingRule>,
    #[serde(default)]
    ml_transport: String,
    #[serde(default)]
    ml_server: String,
    #[serde(default)]
    ml_token: String,
    #[serde(default)]
    extra_keys: Vec<String>,
    #[serde(default)]
    custom_dns: Vec<String>,
    #[serde(default)]
    p2p_relay_addr: String,
    #[serde(default)]
    p2p_secret: String,
    #[serde(default)]
    vpn_dns: String,
    #[serde(default)]
    mitm_enabled: bool,
    #[serde(default)]
    spoof_ips: String,
    #[serde(default)]
    multi_bridges: Vec<serde_json::Value>,
    #[serde(default)]
    tls_fingerprint: String,
}

fn default_true() -> bool {
    true
}
fn default_tun() -> String {
    "Mixed".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            conn_key: String::new(),
            auto_connect: false,
            theme: "dark".to_string(),
            mihomo_port: 9887,
            socks_addr: "127.0.0.1:1081".to_string(),
            kill_switch: false,
            dns_redirect: false,
            ipv6: true,
            tun_stack: "Mixed".to_string(),
            hwid: true,
            auth_tip: true,
            secret: String::new(),
            routing_rules: Vec::new(),
            blocklist: Vec::new(),
            ml_transport: String::new(),
            ml_server: String::new(),
            ml_token: String::new(),
            extra_keys: Vec::new(),
            custom_dns: Vec::new(),
            p2p_relay_addr: String::new(),
            p2p_secret: String::new(),
            vpn_dns: String::new(),
            mitm_enabled: false,
            spoof_ips: String::new(),
            multi_bridges: Vec::new(),
            tls_fingerprint: String::new(),
        }
    }
}

struct AppState {
    mihomo: Mutex<MihomoManager>,
    go_client: Mutex<GoClientManager>,
    ml_server: Mutex<MlServerManager>,
    watchdog_specs: Mutex<Vec<ExtraKeySpec>>,
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("settings.json")
}

fn mihomo_config_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("mihomo_config.yaml")
}

#[tauri::command]
fn get_app_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app);
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let settings: AppSettings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        Ok(settings)
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
fn save_app_setting(app: tauri::AppHandle, mut settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if path.exists() {
        if let Ok(raw) = fs::read_to_string(&path) {
            if let Ok(existing) = serde_json::from_str::<AppSettings>(&raw) {
                settings.routing_rules = existing.routing_rules;
                settings.blocklist = existing.blocklist;
                settings.ml_transport = existing.ml_transport;
                settings.ml_server = existing.ml_server;
                settings.ml_token = existing.ml_token;
                settings.extra_keys = existing.extra_keys;
                if settings.custom_dns.is_empty() { settings.custom_dns = existing.custom_dns; }
                if settings.p2p_relay_addr.is_empty() { settings.p2p_relay_addr = existing.p2p_relay_addr; }
                if settings.p2p_secret.is_empty() { settings.p2p_secret = existing.p2p_secret; }
                if settings.vpn_dns.is_empty() { settings.vpn_dns = existing.vpn_dns; }
                if settings.spoof_ips.is_empty() { settings.spoof_ips = existing.spoof_ips; }
                if !settings.mitm_enabled { settings.mitm_enabled = existing.mitm_enabled; }
                if settings.multi_bridges.is_empty() { settings.multi_bridges = existing.multi_bridges; }
                if settings.tls_fingerprint.is_empty() { settings.tls_fingerprint = existing.tls_fingerprint; }
            }
        }
    }
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// Patch a single field in settings.json by merging a JSON object.
#[tauri::command]
fn patch_app_settings(app: tauri::AppHandle, patch: serde_json::Value) -> Result<(), String> {
    let path = settings_path(&app);
    let mut current: serde_json::Value = if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if let (Some(obj), Some(patch_obj)) = (current.as_object_mut(), patch.as_object()) {
        for (k, v) in patch_obj {
            obj.insert(k.clone(), v.clone());
        }
    }
    let data = serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn connect(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut settings = get_app_settings(app.clone())?;

    if settings.conn_key.is_empty() {
        return Err("Connection key is required (whispera://...)".to_string());
    }

    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };

    let (ml_transport, key_enable_ml) = {
        use base64::Engine as _;
        let raw = settings.conn_key.trim_start_matches("whispera://");
        let (host, port, enable_ml) = if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(raw) {
            if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let srv = j["server"].as_str().unwrap_or("");
                let h = srv.split(':').next().unwrap_or("").to_string();
                let p: u16 = srv.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(8443);
                let ml = j["enable_ml"].as_bool().unwrap_or(false);
                (h, p, ml)
            } else {
                (String::new(), 8443u16, false)
            }
        } else {
            (String::new(), 8443u16, false)
        };

        let transport = if !host.is_empty() {
            let ml_c = ml_client();
            match ml_request(&ml_c, reqwest::Method::POST, &ml_url("/recommend/transport"))
                .timeout(Duration::from_secs(3))
                .json(&serde_json::json!({ "server_host": host, "server_port": port }))
                .send()
                .await
            {
                Ok(resp) => resp.json::<serde_json::Value>().await
                    .ok()
                    .and_then(|j| j["transport"].as_str().map(|s| s.to_string()))
                    .unwrap_or_default(),
                Err(_) => String::new(),
            }
        } else {
            String::new()
        };
        (transport, enable_ml)
    };

    if !ml_transport.is_empty() {
        settings.ml_transport = ml_transport.clone();
        let path = settings_path(&app);
        if let Ok(data) = serde_json::to_string_pretty(&settings) {
            fs::write(&path, data).ok();
        }
    }

    let transport_to_use = if !ml_transport.is_empty() { &ml_transport } else { "" };

    let (ml_token_val, ml_server_val) = if key_enable_ml {
        (settings.ml_token.clone(), ml_url(""))
    } else {
        (String::new(), String::new())
    };

    let mut gc = state.go_client.lock().map_err(|e| e.to_string())?;
    eprintln!("[connect] starting go-client, socks={}, transport={}, key_len={}, ml={}", socks_addr, transport_to_use, settings.conn_key.len(), key_enable_ml);
    gc.start(&GoClientConfig {
        conn_key: &settings.conn_key,
        server_addr: "",
        ml_token: &ml_token_val,
        socks_addr: &socks_addr,
        kill_switch: settings.kill_switch,
        transport: transport_to_use,
        ml_server_url: &ml_server_val,
        vpn_dns: &settings.vpn_dns,
        mitm_enabled: settings.mitm_enabled,
        spoof_ips: &settings.spoof_ips,
    }).map_err(|e| { eprintln!("[connect] go-client start FAILED: {}", e); e })?;
    eprintln!("[connect] go-client started OK");

    if !settings.multi_bridges.is_empty() {
        let bridges_clone = settings.multi_bridges.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(800)).await;
            let client = reqwest::Client::new();
            for b in &bridges_clone {
                if let Err(e) = client
                    .post("http://127.0.0.1:10801/multi-bridges")
                    .json(b)
                    .send()
                    .await
                {
                    eprintln!("[multi-bridge] restore failed: {}", e);
                }
            }
        });
    }

    gc.stop_extras();
    let mut active_extras = 0usize;
    for (i, extra_key) in settings.extra_keys.iter().enumerate() {
        if extra_key.is_empty() { continue; }
        let socks_port = 10900u16 + i as u16;
        let ctrl_port = GoClientManager::extra_control_port(i);
        if let Err(e) = gc.start_extra(extra_key, socks_port, ctrl_port) {
            eprintln!("[connect] extra key {} start failed: {}", i, e);
        } else {
            eprintln!("[connect] extra key {} started on socks:{} ctrl:{}", i, socks_port, ctrl_port);
            active_extras += 1;
        }
    }
    if let Ok(mut cnt) = EXTRA_KEY_COUNT.lock() { *cnt = active_extras; }
    if let Ok(mut specs) = state.watchdog_specs.lock() {
        *specs = settings.extra_keys.iter().enumerate()
            .filter(|(_, k)| !k.is_empty())
            .map(|(i, k)| ExtraKeySpec {
                key: k.clone(),
                socks_port: 10900u16 + i as u16,
                ctrl_port: GoClientManager::extra_control_port(i),
            })
            .collect();
    }

    let config_path = mihomo_config_path(&app);
    let mut routing_rules: Vec<mihomo::MihomoRoutingRule> = Vec::new();
    for r in &settings.blocklist {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: "REJECT".to_string(),
        });
    }
    for r in &settings.routing_rules {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: r.action.clone(),
        });
    }

    let extra_addrs: Vec<String> = settings.extra_keys.iter().enumerate()
        .filter(|(_, k)| !k.is_empty())
        .map(|(i, _)| format!("127.0.0.1:{}", 10900u16 + i as u16))
        .collect();

    let mihomo_config = mihomo::generate_config(&mihomo::MihomoConfig {
        socks_addr: &socks_addr,
        mixed_port: settings.mihomo_port,
        tun_stack: &settings.tun_stack,
        dns_redirect: settings.dns_redirect,
        ipv6: settings.ipv6,
        routing_rules: &routing_rules,
        extra_socks_addrs: &extra_addrs,
        custom_dns: &settings.custom_dns,
        tls_fingerprint: &settings.tls_fingerprint,
    });
    fs::write(&config_path, &mihomo_config).map_err(|e| e.to_string())?;

    let mut mgr = state.mihomo.lock().map_err(|e| e.to_string())?;
    mgr.start(&config_path)?;

    Ok(format!(
        "Connected via key (socks5: {}) | mihomo port {}",
        settings.socks_addr, settings.mihomo_port
    ))
}

#[tauri::command]
async fn connect_ml(
    app: tauri::AppHandle,
    server: String,
    token: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let settings = get_app_settings(app.clone())?;

    if server.is_empty() && settings.conn_key.is_empty() {
        return Err("Connection key or server address required".to_string());
    }
    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };

    let need_ml_wait = {
        let mut ml = state.ml_server.lock().map_err(|e| e.to_string())?;
        if !ml.is_running() {
            ml.set_token(&token);
            ml.start().ok();
            true
        } else {
            false
        }
    };
    if need_ml_wait {
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    if let Ok(mut ep) = ML_ENDPOINT.lock() {
        if !settings.ml_server.is_empty() {
            *ep = settings.ml_server.clone();
        } else {
            *ep = "http://127.0.0.1:8000".to_string();
        }
    }
    let ml_endpoint = ml_url("");

    let host = server.split(':').next().unwrap_or(&server).to_string();
    let port: u16 = server.split(':').nth(1).and_then(|p| p.parse().ok()).unwrap_or(8443);
    let ml_c2 = ml_client();
    let ml_transport = match ml_request(&ml_c2, reqwest::Method::POST, &ml_url("/recommend/transport"))
        .timeout(Duration::from_secs(3))
        .json(&serde_json::json!({ "server_host": host, "server_port": port }))
        .send()
        .await
    {
        Ok(resp) => resp.json::<serde_json::Value>().await
            .ok()
            .and_then(|j| j["transport"].as_str().map(|s| s.to_string()))
            .unwrap_or_default(),
        Err(_) => String::new(),
    };

    let path = settings_path(&app);
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(mut s) = serde_json::from_str::<AppSettings>(&raw) {
            s.ml_server = server.clone();
            s.ml_token = token.clone();
            s.ml_transport = ml_transport.clone();
            if let Ok(data) = serde_json::to_string_pretty(&s) { fs::write(&path, data).ok(); }
        }
    }

    let transport_ref: &str = &ml_transport;

    let mut gc = state.go_client.lock().map_err(|e| e.to_string())?;
    gc.start(&GoClientConfig {
        conn_key: &settings.conn_key,
        server_addr: &server,
        ml_token: &token,
        socks_addr: &socks_addr,
        kill_switch: settings.kill_switch,
        transport: transport_ref,
        ml_server_url: &ml_endpoint,
        vpn_dns: &settings.vpn_dns,
        mitm_enabled: settings.mitm_enabled,
        spoof_ips: &settings.spoof_ips,
    })?;

    let config_path = mihomo_config_path(&app);
    let mut routing_rules: Vec<mihomo::MihomoRoutingRule> = Vec::new();
    for r in &settings.blocklist {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: "REJECT".to_string(),
        });
    }
    for r in &settings.routing_rules {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: r.action.clone(),
        });
    }
    let mihomo_config = mihomo::generate_config(&mihomo::MihomoConfig {
        socks_addr: &socks_addr,
        mixed_port: settings.mihomo_port,
        tun_stack: &settings.tun_stack,
        dns_redirect: settings.dns_redirect,
        ipv6: settings.ipv6,
        routing_rules: &routing_rules,
        extra_socks_addrs: &[],
        custom_dns: &settings.custom_dns,
        tls_fingerprint: &settings.tls_fingerprint,
    });
    fs::write(&config_path, &mihomo_config).map_err(|e| e.to_string())?;
    let mut mgr = state.mihomo.lock().map_err(|e| e.to_string())?;
    mgr.start(&config_path)?;

    Ok(format!("ML connected to {} via {}", server, if ml_transport.is_empty() { "tcp" } else { &ml_transport }))
}

#[tauri::command]
fn disconnect(state: tauri::State<AppState>) -> Result<String, String> {
    state.watchdog_specs.lock().ok().map(|mut s| s.clear());

    let mut mihomo = state.mihomo.lock().map_err(|e| e.to_string())?;
    mihomo.stop()?;

    let mut gc = state.go_client.lock().map_err(|e| e.to_string())?;
    gc.stop_extras();
    gc.stop()?;

    Ok("Disconnected".to_string())
}

#[tauri::command]
fn get_status(state: tauri::State<AppState>) -> Result<bool, String> {
    let mut mihomo = state.mihomo.lock().map_err(|e| e.to_string())?;
    let mut gc = state.go_client.lock().map_err(|e| e.to_string())?;
    Ok(mihomo.is_running() && gc.is_running())
}

const CONTROL_PORT_MAIN: u16 = 10801;

fn control_base(port: u16) -> String {
    format!("http://127.0.0.1:{}", port)
}

fn conn_url(id: &str, action: &str) -> String {
    format!("{}/connections/{}/{}", control_base(control_port_for_id(id)), raw_id(id), action)
}

fn control_port_for_id(id: &str) -> u16 {
    if let Some(rest) = id.strip_prefix('e') {
        if let Some(colon) = rest.find(':') {
            if let Ok(i) = rest[..colon].parse::<usize>() {
                return GoClientManager::extra_control_port(i);
            }
        }
    }
    CONTROL_PORT_MAIN
}

fn raw_id(id: &str) -> &str {
    if let Some(rest) = id.strip_prefix('e') {
        if let Some(colon) = rest.find(':') {
            if rest[..colon].chars().all(|c| c.is_ascii_digit()) {
                return &id[id.find(':').unwrap() + 1..];
            }
        }
    }
    id
}

#[tauri::command]
async fn get_connections() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;

    let mut all: Vec<serde_json::Value> = match client
        .get(format!("{}/connections", control_base(CONTROL_PORT_MAIN)))
        .send().await
    {
        Ok(r) => r.json::<Vec<serde_json::Value>>().await.unwrap_or_default(),
        Err(_) => vec![],
    };

    let extra_count = EXTRA_KEY_COUNT.lock().map(|g| *g).unwrap_or(0);
    for i in 0..extra_count {
        let port = GoClientManager::extra_control_port(i);
        if let Ok(r) = client.get(format!("{}/connections", control_base(port))).send().await {
            if let Ok(mut entries) = r.json::<Vec<serde_json::Value>>().await {
                for entry in &mut entries {
                    if let Some(id) = entry.get("id").and_then(|v| v.as_str()) {
                        entry["id"] = serde_json::Value::String(format!("e{}:{}", i, id));
                        entry["key_index"] = serde_json::Value::Number(i.into());
                    }
                }
                all.extend(entries);
            }
        }
    }

    Ok(serde_json::Value::Array(all))
}

#[tauri::command]
async fn close_connection(id: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "close"))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn toggle_connection(id: String, enabled: bool) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "toggle"))
        .json(&serde_json::json!({"enabled": enabled}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn toggle_obfuscation(id: String, enabled: bool) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "obfuscation"))
        .json(&serde_json::json!({"enabled": enabled}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn switch_transport(id: String, transport: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "transport"))
        .json(&serde_json::json!({"transport": transport}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn p2p_status() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(format!("{}/p2p", &control_base(CONTROL_PORT_MAIN)))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn p2p_register(relay_addr: String, secret: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.post(format!("{}/p2p/register", &control_base(CONTROL_PORT_MAIN)))
        .json(&serde_json::json!({"relay_addr": relay_addr, "secret": secret}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    if !resp.status().is_success() {
        return Err(resp.text().await.unwrap_or_default());
    }
    let v = resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    Ok(v["peer_id"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn p2p_connect(target: String, relay_addr: String, secret: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.post(format!("{}/p2p/connect", &control_base(CONTROL_PORT_MAIN)))
        .json(&serde_json::json!({"target": target, "relay_addr": relay_addr, "secret": secret}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(resp.status().is_success())
}

#[tauri::command]
async fn bridge_ping(app: tauri::AppHandle, bridge_id: String, count: Option<u32>, mode: Option<String>) -> Result<serde_json::Value, String> {
    let settings = get_app_settings(app)?;
    let base_url = {
        use base64::Engine as _;
        let raw = settings.conn_key.trim_start_matches("whispera://");
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(raw) {
            if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let srv = j["server"].as_str().unwrap_or("");
                if !srv.is_empty() {
                    let host = srv.split(':').next().unwrap_or("").to_string();
                    let port: u16 = srv.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(8443);
                    format!("https://{}:{}", host, port)
                } else {
                    return Err("no server configured".to_string());
                }
            } else {
                return Err("invalid conn_key".to_string());
            }
        } else {
            return Err("invalid conn_key".to_string());
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "id": bridge_id,
        "count": count.unwrap_or(5),
        "mode": mode.unwrap_or_else(|| "tcp".to_string()),
    });
    let resp = client.post(format!("{}/api/bridge-ping", base_url))
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
async fn bridge_set_label(app: tauri::AppHandle, bridge_id: String, blacklisted: bool) -> Result<bool, String> {
    let settings = get_app_settings(app)?;
    let base_url = {
        use base64::Engine as _;
        let raw = settings.conn_key.trim_start_matches("whispera://");
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(raw) {
            if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let srv = j["server"].as_str().unwrap_or("");
                if !srv.is_empty() {
                    let host = srv.split(':').next().unwrap_or("").to_string();
                    let port: u16 = srv.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(8443);
                    format!("https://{}:{}", host, port)
                } else {
                    return Err("no server configured".to_string());
                }
            } else {
                return Err("invalid conn_key".to_string());
            }
        } else {
            return Err("invalid conn_key".to_string());
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    let body = serde_json::json!({"id": bridge_id, "blacklisted": blacklisted});
    let resp = client.post(format!("{}/api/bridge-label", base_url))
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    Ok(resp.status().is_success())
}

#[tauri::command]
async fn bridge_issue_ssh_key(app: tauri::AppHandle, bridge_id: String, user_id: String, one_time: bool, ttl_hours: u32) -> Result<serde_json::Value, String> {
    let settings = get_app_settings(app)?;
    let base_url = {
        use base64::Engine as _;
        let raw = settings.conn_key.trim_start_matches("whispera://");
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(raw) {
            if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let srv = j["server"].as_str().unwrap_or("");
                if !srv.is_empty() {
                    let host = srv.split(':').next().unwrap_or("").to_string();
                    let port: u16 = srv.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(8443);
                    format!("https://{}:{}", host, port)
                } else {
                    return Err("no server configured".to_string());
                }
            } else {
                return Err("invalid conn_key".to_string());
            }
        } else {
            return Err("invalid conn_key".to_string());
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "bridge_id": bridge_id,
        "user_id": user_id,
        "one_time": one_time,
        "ttl_hours": ttl_hours,
    });
    let resp = client.post(format!("{}/api/bridge-access-key", base_url))
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
async fn bridge_rollout(app: tauri::AppHandle, version: String, binary_url: String, checksum: String) -> Result<serde_json::Value, String> {
    let settings = get_app_settings(app)?;
    let base_url = {
        use base64::Engine as _;
        let raw = settings.conn_key.trim_start_matches("whispera://");
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(raw) {
            if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                let srv = j["server"].as_str().unwrap_or("");
                if !srv.is_empty() {
                    let host = srv.split(':').next().unwrap_or("").to_string();
                    let port: u16 = srv.split(':').nth(1).and_then(|s| s.parse().ok()).unwrap_or(8443);
                    format!("https://{}:{}", host, port)
                } else {
                    return Err("no server configured".to_string());
                }
            } else {
                return Err("invalid conn_key".to_string());
            }
        } else {
            return Err("invalid conn_key".to_string());
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "version": version,
        "binary_url": binary_url,
        "checksum": checksum,
    });
    let resp = client.post(format!("{}/api/bridge-rollout", base_url))
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
async fn p2p_disconnect() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    client.post(format!("{}/p2p/disconnect", &control_base(CONTROL_PORT_MAIN)))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn get_agent_stats() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(format!("{}/agent", &control_base(CONTROL_PORT_MAIN)))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn agent_recommend() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(format!("{}/agent/recommend", &control_base(CONTROL_PORT_MAIN)))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn agent_report(transport: String, server: String, success: bool, latency_ms: u64, error: Option<String>) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    client.post(format!("{}/agent/report", &control_base(CONTROL_PORT_MAIN)))
        .json(&serde_json::json!({
            "transport": transport,
            "server": server,
            "success": success,
            "latency": latency_ms * 1_000_000,
            "error": error.unwrap_or_default(),
        }))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_connection_speed(id: String, rate_limit_kb: i64) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "speed"))
        .json(&serde_json::json!({"rate_limit_kb": rate_limit_kb}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_connection_sni(id: String, sni: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "sni"))
        .json(&serde_json::json!({"sni": sni}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_connection_bridge(id: String, bridge: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "bridge"))
        .json(&serde_json::json!({"bridge": bridge}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn duplicate_connection(id: String) -> Result<String, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    let resp = client.post(conn_url(&id, "duplicate"))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(v["id"].as_str().unwrap_or("").to_string())
}

#[tauri::command]
async fn change_connection_port(id: String, port: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "port"))
        .json(&serde_json::json!({"port": port}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_connection_mux(id: String, enabled: bool) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "mux"))
        .json(&serde_json::json!({"enabled": enabled}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_transport_secure(id: String, enabled: bool) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(2)).build()
        .map_err(|e| e.to_string())?;
    client.post(conn_url(&id, "transport_secure"))
        .json(&serde_json::json!({"enabled": enabled}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    Ok(true)
}

#[tauri::command]
async fn set_behavioral_profile(id: String, profile: String) -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(3)).build()
        .map_err(|e| e.to_string())?;
    let resp = client.post(conn_url(&id, "profile"))
        .json(&serde_json::json!({"profile": profile}))
        .send().await.map_err(|_| "control server unavailable".to_string())?;
    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("set_profile failed: {}", msg));
    }
    Ok(true)
}

#[tauri::command]
async fn encapsulate_connection(inner_id: String, outer_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(5)).build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(conn_url(&inner_id, "encapsulate"))
        .json(&serde_json::json!({ "wrap_in": outer_id }))
        .send().await
        .map_err(|_| "control server unavailable".to_string())?;
    if !resp.status().is_success() {
        let msg = resp.text().await.unwrap_or_default();
        return Err(format!("encapsulate failed: {}", msg));
    }
    resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct SiteCheckResult {
    status: u16,
    ping_ms: u64,
}

#[tauri::command]
async fn check_site(url: String) -> Result<SiteCheckResult, String> {
    let host = url
        .replace("https://", "")
        .replace("http://", "")
        .split('/')
        .next()
        .unwrap_or("")
        .to_string();

    if host.is_empty() {
        return Err("Invalid URL".to_string());
    }

    let addr = format!("{}:443", host);
    let start = std::time::Instant::now();

    match tokio::time::timeout(
        Duration::from_secs(5),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(_stream)) => {
            let ping = start.elapsed().as_millis() as u64;
            Ok(SiteCheckResult {
                status: 200,
                ping_ms: ping,
            })
        }
        Ok(Err(e)) => Err(format!("Connect failed: {}", e)),
        Err(_) => Err("Timeout".to_string()),
    }
}

#[derive(Serialize)]
struct IpInfoResponse {
    ip: String,
    city: String,
    region: String,
    country: String,
    org: String,
    loc: String,
}

#[tauri::command]
async fn get_ip_info() -> Result<IpInfoResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://ipinfo.io/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    Ok(IpInfoResponse {
        ip: json["ip"].as_str().unwrap_or("—").to_string(),
        city: json["city"].as_str().unwrap_or("—").to_string(),
        region: json["region"].as_str().unwrap_or("—").to_string(),
        country: json["country"].as_str().unwrap_or("—").to_string(),
        org: json["org"].as_str().unwrap_or("—").to_string(),
        loc: json["loc"].as_str().unwrap_or("").to_string(),
    })
}

#[derive(Serialize)]
struct SystemInfoResponse {
    os: String,
    uptime: String,
    version: String,
    admin: bool,
}

#[tauri::command]
fn get_system_info() -> Result<SystemInfoResponse, String> {
    let os_info = format!("Windows ({})", std::env::consts::ARCH);

    let uptime_ms = winapi_uptime();
    let uptime_secs = uptime_ms / 1000;
    let hours = uptime_secs / 3600;
    let minutes = (uptime_secs % 3600) / 60;
    let uptime = format!("{}h {}m", hours, minutes);

    let admin = is_elevated();

    Ok(SystemInfoResponse {
        os: os_info,
        uptime,
        version: format!("v{}", env!("CARGO_PKG_VERSION")),
        admin,
    })
}

fn winapi_uptime() -> u64 {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetTickCount64() -> u64;
        }
        unsafe { GetTickCount64() }
    }
    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

fn is_elevated() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("net")
            .arg("session")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
fn open_config_dir(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_ml_transport(app: tauri::AppHandle) -> Result<String, String> {
    Ok(get_app_settings(app)?.ml_transport)
}

#[tauri::command]
fn get_routing_rules(app: tauri::AppHandle) -> Result<Vec<RoutingRule>, String> {
    let settings = get_app_settings(app)?;
    Ok(settings.routing_rules)
}

#[tauri::command]
async fn save_routing_rules(app: tauri::AppHandle, rules: Vec<RoutingRule>) -> Result<(), String> {
    let path = settings_path(&app);
    let mut settings = get_app_settings(app.clone())?;
    settings.routing_rules = rules;
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, &data).map_err(|e| e.to_string())?;

    let config_path = mihomo_config_path(&app);
    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };
    let mut routing_rules: Vec<mihomo::MihomoRoutingRule> = Vec::new();
    for r in &settings.blocklist {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: "REJECT".to_string(),
        });
    }
    for r in &settings.routing_rules {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: r.action.clone(),
        });
    }
    let mihomo_config = mihomo::generate_config(&mihomo::MihomoConfig {
        socks_addr: &socks_addr,
        mixed_port: settings.mihomo_port,
        tun_stack: &settings.tun_stack,
        dns_redirect: settings.dns_redirect,
        ipv6: settings.ipv6,
        routing_rules: &routing_rules,
        extra_socks_addrs: &[],
        custom_dns: &settings.custom_dns,
        tls_fingerprint: &settings.tls_fingerprint,
    });
    fs::write(&config_path, &mihomo_config).map_err(|e| e.to_string())?;

    let config_str = config_path.to_string_lossy().replace('\\', "/");
    let _ = reqwest::Client::new()
        .put("http://127.0.0.1:9090/configs?force=true")
        .json(&serde_json::json!({ "path": config_str }))
        .timeout(Duration::from_secs(3))
        .send()
        .await;

    Ok(())
}

/// Regenerate mihomo config with current settings (incl. tls_fingerprint) and hot-reload via external controller.
#[tauri::command]
async fn apply_tls_fingerprint(app: tauri::AppHandle) -> Result<(), String> {
    let settings = get_app_settings(app.clone())?;
    let config_path = mihomo_config_path(&app);
    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };
    let mut routing_rules: Vec<mihomo::MihomoRoutingRule> = Vec::new();
    for r in &settings.blocklist {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: "REJECT".to_string(),
        });
    }
    for r in &settings.routing_rules {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: r.action.clone(),
        });
    }
    let mihomo_config = mihomo::generate_config(&mihomo::MihomoConfig {
        socks_addr: &socks_addr,
        mixed_port: settings.mihomo_port,
        tun_stack: &settings.tun_stack,
        dns_redirect: settings.dns_redirect,
        ipv6: settings.ipv6,
        routing_rules: &routing_rules,
        extra_socks_addrs: &[],
        custom_dns: &settings.custom_dns,
        tls_fingerprint: &settings.tls_fingerprint,
    });
    fs::write(&config_path, &mihomo_config).map_err(|e| e.to_string())?;

    let config_str = config_path.to_string_lossy().replace('\\', "/");
    reqwest::Client::new()
        .put("http://127.0.0.1:9090/configs?force=true")
        .json(&serde_json::json!({ "path": config_str }))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .map_err(|e| format!("mihomo reload failed: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_blocklist(app: tauri::AppHandle) -> Result<Vec<RoutingRule>, String> {
    let settings = get_app_settings(app)?;
    Ok(settings.blocklist)
}

#[tauri::command]
async fn save_blocklist(app: tauri::AppHandle, rules: Vec<RoutingRule>) -> Result<(), String> {
    let path = settings_path(&app);
    let mut settings = get_app_settings(app.clone())?;
    settings.blocklist = rules;
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, &data).map_err(|e| e.to_string())?;

    let config_path = mihomo_config_path(&app);
    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };
    let mut routing_rules: Vec<mihomo::MihomoRoutingRule> = Vec::new();
    for r in &settings.blocklist {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: "REJECT".to_string(),
        });
    }
    for r in &settings.routing_rules {
        routing_rules.push(mihomo::MihomoRoutingRule {
            kind: r.kind.clone(),
            value: r.value.clone(),
            action: r.action.clone(),
        });
    }
    let mihomo_config = mihomo::generate_config(&mihomo::MihomoConfig {
        socks_addr: &socks_addr,
        mixed_port: settings.mihomo_port,
        tun_stack: &settings.tun_stack,
        dns_redirect: settings.dns_redirect,
        ipv6: settings.ipv6,
        routing_rules: &routing_rules,
        extra_socks_addrs: &[],
        custom_dns: &settings.custom_dns,
        tls_fingerprint: &settings.tls_fingerprint,
    });
    fs::write(&config_path, &mihomo_config).map_err(|e| e.to_string())?;

    let config_str = config_path.to_string_lossy().replace('\\', "/");
    let _ = reqwest::Client::new()
        .put("http://127.0.0.1:9090/configs?force=true")
        .json(&serde_json::json!({ "path": config_str }))
        .timeout(Duration::from_secs(3))
        .send()
        .await;

    Ok(())
}

#[tauri::command]
fn install_services(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let settings = get_app_settings(app.clone())?;
    let config_path = mihomo_config_path(&app);

    if !config_path.exists() {
        let stub = mihomo::generate_config(&mihomo::MihomoConfig {
            socks_addr: &settings.socks_addr,
            mixed_port: settings.mihomo_port,
            tun_stack: &settings.tun_stack,
            dns_redirect: settings.dns_redirect,
            ipv6: settings.ipv6,
            routing_rules: &[],
            extra_socks_addrs: &[],
            custom_dns: &settings.custom_dns,
            tls_fingerprint: &settings.tls_fingerprint,
        });
        fs::write(&config_path, &stub).ok();
    }

    let socks_addr = if settings.socks_addr.contains(':') {
        settings.socks_addr.clone()
    } else {
        format!("{}:1080", settings.socks_addr)
    };

    {
        let mihomo_mgr = state.mihomo.lock().map_err(|e| e.to_string())?;
        mihomo_mgr.install_service(&config_path)?;
    }
    {
        let gc_mgr = state.go_client.lock().map_err(|e| e.to_string())?;
        gc_mgr.install_service(&go_client::GoClientConfig {
            conn_key: &settings.conn_key,
            server_addr: "",
            ml_token: "",
            socks_addr: &socks_addr,
            kill_switch: settings.kill_switch,
            transport: &settings.ml_transport,
            ml_server_url: "",
            vpn_dns: &settings.vpn_dns,
            mitm_enabled: settings.mitm_enabled,
            spoof_ips: &settings.spoof_ips,
        })?;
    }

    Ok("Services installed: WhisperaNH, WhisperaGW".to_string())
}


#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SubscriptionEntry {
    id: String,
    name: String,
    url: String,
    keys: Vec<String>,
    servers: Vec<serde_json::Value>,
    updated: String,
}

fn subscriptions_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("subscriptions.json")
}

fn load_subs(app: &tauri::AppHandle) -> Vec<SubscriptionEntry> {
    let path = subscriptions_path(app);
    if !path.exists() { return Vec::new(); }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_subs(app: &tauri::AppHandle, subs: &[SubscriptionEntry]) {
    if let Ok(data) = serde_json::to_string_pretty(subs) {
        fs::write(subscriptions_path(app), data).ok();
    }
}

async fn fetch_sub_url(url: &str) -> Result<SubscriptionEntry, String> {
    use base64::Engine as _;
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let text = client
        .get(url)
        .header("User-Agent", "Whisp/1.0")
        .send()
        .await
        .map_err(|e| format!("fetch failed: {}", e))?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .map_err(|e| format!("base64: {}", e))?;
    let payload: serde_json::Value =
        serde_json::from_slice(&decoded).map_err(|e| format!("json: {}", e))?;
    let keys = payload["keys"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let servers = payload["servers"].as_array().cloned().unwrap_or_default();
    let name = payload["name"].as_str().unwrap_or("").to_string();
    let updated = payload["updated"].as_str().unwrap_or("").to_string();
    Ok(SubscriptionEntry { id: String::new(), name, url: url.to_string(), keys, servers, updated })
}

#[tauri::command]
fn get_subscriptions(app: tauri::AppHandle) -> Vec<SubscriptionEntry> {
    load_subs(&app)
}

#[tauri::command]
async fn add_subscription(
    app: tauri::AppHandle,
    name: String,
    url: String,
) -> Result<SubscriptionEntry, String> {
    let mut entry = fetch_sub_url(&url).await?;
    entry.id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string();
    if !name.is_empty() {
        entry.name = name;
    }
    entry.url = url;
    let mut subs = load_subs(&app);
    subs.push(entry.clone());
    save_subs(&app, &subs);
    Ok(entry)
}

#[tauri::command]
async fn refresh_subscription(
    app: tauri::AppHandle,
    id: String,
) -> Result<SubscriptionEntry, String> {
    let mut subs = load_subs(&app);
    let idx = subs.iter().position(|s| s.id == id).ok_or("Subscription not found")?;
    let url = subs[idx].url.clone();
    let fresh = fetch_sub_url(&url).await?;
    subs[idx].keys = fresh.keys;
    subs[idx].servers = fresh.servers;
    subs[idx].updated = fresh.updated;
    if subs[idx].name.is_empty() && !fresh.name.is_empty() {
        subs[idx].name = fresh.name;
    }
    let result = subs[idx].clone();
    save_subs(&app, &subs);
    Ok(result)
}

#[tauri::command]
fn delete_subscription(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut subs = load_subs(&app);
    subs.retain(|s| s.id != id);
    save_subs(&app, &subs);
    Ok(())
}

#[tauri::command]
fn rename_subscription(app: tauri::AppHandle, id: String, name: String) -> Result<(), String> {
    let mut subs = load_subs(&app);
    let idx = subs.iter().position(|s| s.id == id).ok_or("not found")?;
    subs[idx].name = name;
    save_subs(&app, &subs);
    Ok(())
}

#[tauri::command]
async fn ping_key(key: String) -> Result<u64, String> {
    let key = key.trim();
    let host_port = key
        .strip_prefix("whispera://")
        .ok_or("not a whispera:// key")?
        .split('?')
        .next()
        .filter(|s| !s.is_empty())
        .ok_or("cannot parse server address")?
        .to_string();
    let start = std::time::Instant::now();
    tokio::time::timeout(
        Duration::from_secs(5),
        tokio::net::TcpStream::connect(&host_port),
    )
    .await
    .map_err(|_| "timeout".to_string())?
    .map_err(|e| e.to_string())?;
    Ok(start.elapsed().as_millis() as u64)
}

fn read_ml_api_token() -> String {
    let path = if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|a| format!(r"{}\Whispera\api_token", a))
            .unwrap_or_default()
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|h| format!("{}/Library/Application Support/Whispera/api_token", h))
            .unwrap_or_default()
    } else {
        std::env::var("XDG_CONFIG_HOME")
            .map(|x| format!("{}/whispera/api_token", x))
            .unwrap_or_else(|_| {
                std::env::var("HOME")
                    .map(|h| format!("{}/.config/whispera/api_token", h))
                    .unwrap_or_default()
            })
    };
    if path.is_empty() { return String::new(); }
    std::fs::read_to_string(&path)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn ml_client() -> reqwest::Client {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn ml_url(path: &str) -> String {
    let base = ML_ENDPOINT.lock().map(|s| s.clone()).unwrap_or_default();
    if base.is_empty() {
        format!("http://127.0.0.1:8000{}", path)
    } else {
        let trimmed = base.trim_end_matches('/');
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            format!("{}{}", trimmed, path)
        } else {
            format!("http://{}{}", trimmed, path)
        }
    }
}

fn ml_request(
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
) -> reqwest::RequestBuilder {
    let token = read_ml_api_token();
    let req = client.request(method, url);
    if token.is_empty() {
        req
    } else {
        req.header("Authorization", format!("Bearer {}", token))
    }
}

#[tauri::command]
fn get_ml_api_token() -> String {
    read_ml_api_token()
}

#[tauri::command]
async fn get_ml_status(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    {
        let mut ml = state.ml_server.lock().map_err(|e| e.to_string())?;
        if ml.is_running() {
            return Ok(true);
        }
    }
    let ok = ml_client()
        .get(ml_url("/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    Ok(ok)
}

#[tauri::command]
fn start_ml_server(state: tauri::State<AppState>) -> Result<String, String> {
    let mut ml = state.ml_server.lock().map_err(|e| e.to_string())?;
    ml.start()?;
    Ok("ML server started".to_string())
}

#[tauri::command]
fn stop_ml_server(state: tauri::State<AppState>) -> Result<String, String> {
    let mut ml = state.ml_server.lock().map_err(|e| e.to_string())?;
    ml.stop()?;
    Ok("ML server stopped".to_string())
}

#[tauri::command]
fn get_ml_logs(state: tauri::State<AppState>) -> Result<String, String> {
    let ml = state.ml_server.lock().map_err(|e| e.to_string())?;
    Ok(ml.get_log_tail(150))
}

#[tauri::command]
fn clear_ml_logs(state: tauri::State<AppState>) -> Result<(), String> {
    let ml = state.ml_server.lock().map_err(|e| e.to_string())?;
    ml.clear_logs()
}

#[tauri::command]
fn ml_binary_exists(state: tauri::State<AppState>) -> Result<bool, String> {
    let ml = state.ml_server.lock().map_err(|e| e.to_string())?;
    Ok(ml.binary_exists())
}

#[tauri::command]
async fn ml_rank_bridges(bridges_json: String) -> Result<String, String> {
    let client = ml_client();

    let resp = ml_request(&client, reqwest::Method::POST, &ml_url("/rank/bridges"))
        .timeout(Duration::from_secs(5))
        .header("Content-Type", "application/json")
        .body(bridges_json)
        .send()
        .await
        .map_err(|e| format!("ML server unavailable: {}", e))?;

    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn ml_analyze_network(host: String, port: u16) -> Result<String, String> {
    let client = ml_client();

    let body = serde_json::json!({ "host": host, "port": port });

    let resp = ml_request(&client, reqwest::Method::POST, &ml_url("/network/analyze"))
        .timeout(Duration::from_secs(15))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("ML server unavailable: {}", e))?;

    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn ml_recommend_transport(server_host: String, server_port: u16) -> Result<String, String> {
    let client = ml_client();

    let body = serde_json::json!({ "server_host": server_host, "server_port": server_port });

    let resp = ml_request(&client, reqwest::Method::POST, &ml_url("/recommend/transport"))
        .timeout(Duration::from_secs(15))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("ML server unavailable: {}", e))?;

    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn ml_export_dataset(app: tauri::AppHandle) -> Result<String, String> {
    let client = ml_client();
    let resp = ml_request(&client, reqwest::Method::GET, &ml_url("/federated/dataset"))
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|e| format!("ML server unavailable: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("ML server returned {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Ok("Dataset is empty".to_string());
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let ds_dir = data_dir.join("datasets");
    std::fs::create_dir_all(&ds_dir).ok();

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let filename = format!("whispera_ml_dataset_{}.jsonl", ts);
    let path = ds_dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    let latest = ds_dir.join("whispera_ml_dataset_latest.jsonl");
    std::fs::copy(&path, &latest).ok();

    let lines = bytes.iter().filter(|&&b| b == b'\n').count();
    Ok(format!(
        "Exported {} samples ({:.1} MB) to {}",
        lines,
        bytes.len() as f64 / (1024.0 * 1024.0),
        path.display()
    ))
}

#[tauri::command]
async fn ml_dataset_stats() -> Result<String, String> {
    let client = ml_client();
    let resp = ml_request(&client, reqwest::Method::GET, &ml_url("/federated/dataset/stats"))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("ML server unavailable: {}", e))?;
    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
fn uninstall_services(state: tauri::State<AppState>) -> Result<String, String> {
    {
        let mut mihomo_mgr = state.mihomo.lock().map_err(|e| e.to_string())?;
        mihomo_mgr.uninstall_service()?;
    }
    {
        let mut gc_mgr = state.go_client.lock().map_err(|e| e.to_string())?;
        gc_mgr.uninstall_service()?;
    }
    Ok("Services removed".to_string())
}

#[derive(Debug, Clone, Serialize)]
struct ProcessInfo {
    name: String,
    pid: u32,
}

#[tauri::command]
fn list_processes() -> Vec<ProcessInfo> {
    let mut result = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let out = std::process::Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .creation_flags(0x08000000u32)
            .output();
        if let Ok(out) = out {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut seen = std::collections::HashSet::new();
            for line in text.lines() {
                let line = line.trim().trim_matches('"');
                let parts: Vec<&str> = line.splitn(6, "\",\"").collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim_matches('"').to_string();
                    let pid: u32 = parts[1].trim_matches('"').parse().unwrap_or(0);
                    if !name.is_empty() && seen.insert(name.to_lowercase()) {
                        result.push(ProcessInfo { name, pid });
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let out = std::process::Command::new("ps")
            .args(["-eo", "comm,pid", "--no-headers"])
            .output();
        if let Ok(out) = out {
            let text = String::from_utf8_lossy(&out.stdout);
            let mut seen = std::collections::HashSet::new();
            for line in text.lines() {
                let parts: Vec<&str> = line.trim().splitn(2, ' ').collect();
                if parts.len() == 2 {
                    let name = parts[0].trim().to_string();
                    let pid: u32 = parts[1].trim().parse().unwrap_or(0);
                    if !name.is_empty() && seen.insert(name.to_lowercase()) {
                        result.push(ProcessInfo { name, pid });
                    }
                }
            }
        }
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result
}

fn main() {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    #[cfg(target_os = "android")]
    let mihomo_path = exe_dir.join("mihomo");
    #[cfg(not(target_os = "android"))]
    let mihomo_path = exe_dir.join("mihomo.exe");

    #[cfg(target_os = "android")]
    let go_client_path = exe_dir.join("whispera-go-client");
    #[cfg(not(target_os = "android"))]
    let go_client_path = exe_dir.join("whispera-go-client.exe");

    #[cfg(target_os = "android")]
    let ml_server_path = PathBuf::new();
    #[cfg(all(not(target_os = "android"), dev))]
    let ml_server_path = exe_dir.join("whispera-ml-server.exe");
    #[cfg(all(not(target_os = "android"), not(dev)))]
    let ml_server_path = {
        let candidate = exe_dir.join("whispera-ml-server.exe");
        if candidate.exists() {
            candidate
        } else {
            exe_dir.join("_up_").join("whispera-ml-server.exe")
        }
    };
    let ml_log_path = exe_dir.join("ml-server.log");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            mihomo: Mutex::new(MihomoManager::new(mihomo_path)),
            go_client: Mutex::new(GoClientManager::new(go_client_path)),
            ml_server: Mutex::new(MlServerManager::new(ml_server_path, ml_log_path)),
            watchdog_specs: Mutex::new(Vec::new()),
        })
        .setup(|app| {
            let ml_app = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let state: tauri::State<AppState> = ml_app.state();
                let api_token = read_ml_api_token();
                if let Ok(mut ml) = state.ml_server.lock() {
                    if !api_token.is_empty() {
                        ml.set_token(&api_token);
                    }
                    ml.start().ok();
                }
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    // Collect specs without holding the State reference across await
                    let specs: Vec<ExtraKeySpec> = {
                        let state: tauri::State<AppState> = app_handle.state();
                        let guard = match state.watchdog_specs.lock() {
                            Ok(g) => g,
                            Err(_) => continue,
                        };
                        let cloned = guard.clone();
                        drop(guard);
                        cloned
                    };
                    if specs.is_empty() { continue; }
                    let n: usize = {
                        let state: tauri::State<AppState> = app_handle.state();
                        let x = match state.go_client.lock() {
                            Ok(mut gc) => {
                                let n = gc.check_and_restart_extras(&specs);
                                drop(gc);
                                n
                            }
                            Err(_) => 0,
                        }; x
                    };
                    if n > 0 {
                        eprintln!("[watchdog] restarted {} extra process(es)", n);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let app = window.app_handle();
                let state: tauri::State<AppState> = app.state();
                state.mihomo.lock().ok().map(|mut m| m.stop().ok());
                state.go_client.lock().ok().map(|mut gc| gc.stop().ok());
                state.ml_server.lock().ok().map(|mut ml| ml.stop().ok());
                window.close().ok();
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_processes,
            get_app_settings,
            save_app_setting,
            patch_app_settings,
            apply_tls_fingerprint,
            connect,
            disconnect,
            get_status,
            check_site,
            get_ip_info,
            get_system_info,
            open_config_dir,
            open_url,
            install_services,
            uninstall_services,
            get_routing_rules,
            save_routing_rules,
            get_blocklist,
            save_blocklist,
            get_ml_transport,
            connect_ml,
            get_ml_status,
            get_ml_api_token,
            start_ml_server,
            stop_ml_server,
            get_ml_logs,
            clear_ml_logs,
            ml_binary_exists,
            ml_rank_bridges,
            ml_analyze_network,
            ml_recommend_transport,
            ml_export_dataset,
            ml_dataset_stats,
            get_subscriptions,
            add_subscription,
            refresh_subscription,
            delete_subscription,
            rename_subscription,
            ping_key,
            get_connections,
            close_connection,
            toggle_connection,
            toggle_obfuscation,
            switch_transport,
            set_connection_speed,
            set_connection_sni,
            set_connection_bridge,
            duplicate_connection,
            set_connection_mux,
            change_connection_port,
            encapsulate_connection,
            set_transport_secure,
            set_behavioral_profile,
            get_agent_stats,
            agent_recommend,
            agent_report,
            p2p_status,
            p2p_register,
            p2p_connect,
            p2p_disconnect,
            bridge_ping,
            bridge_set_label,
            bridge_issue_ssh_key,
            bridge_rollout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
