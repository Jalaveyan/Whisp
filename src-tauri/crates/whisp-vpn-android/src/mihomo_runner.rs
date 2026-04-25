//! Запуск mihomo как child process с inherited TUN-fd.
//!
//! mihomo на Android используется только в gVisor stack mode — ему отдают
//! file descriptor от VpnService.Builder.establish() и через `tun.device: fd://N`
//! он сам читает/пишет IP-пакеты на этот fd.
//!
//! Чтобы fd выжил через exec, нужно явно сохранить его (по умолчанию Rust
//! Command ставит FD_CLOEXEC). Делаем это через crate command-fds.
//!
//! Циклы (mihomo'шные исходящие сокеты обратно в TUN) исключаются на уровне
//! Kotlin: `Builder.addDisallowedApplication(packageName)` — наш UID не идёт
//! через TUN.

use crate::rules::{RoutingAction, RoutingRule};
use std::fs;
use std::io::{Read, Write};
use std::os::unix::io::RawFd;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

pub struct MihomoChild {
    pub child: Child,
    pub work_dir: PathBuf,
}

impl MihomoChild {
    pub fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        // work_dir чистим best-effort.
        let _ = fs::remove_dir_all(&self.work_dir);
    }
}

/// Запуск mihomo с TUN-fd. Возвращает дочерний процесс, который надо хранить
/// в state и kill'ать на disconnect.
///
/// `mihomo_path` — обычно `<nativeLibraryDir>/libmihomo.so` (Tauri пакетит
/// бинари с префиксом lib и .so).
/// `tun_fd` — RawFd от VpnService.Builder.establish().getFd().
/// `socks_upstream` — Some("127.0.0.1:1080") если есть локальный go-client,
/// иначе None — тогда mihomo идёт DIRECT на всё (полезно для smoke-теста).
pub fn spawn_mihomo(
    mihomo_path: &Path,
    tun_fd: RawFd,
    socks_upstream: Option<&str>,
    rules: &[RoutingRule],
) -> Result<MihomoChild, String> {
    if !mihomo_path.exists() {
        return Err(format!("mihomo not found at {}", mihomo_path.display()));
    }

    // Mihomo требует data-dir (-d <path>) с config.yaml. Кладём в private cache.
    let work_dir = std::env::temp_dir().join(format!("whisp-mihomo-{}", std::process::id()));
    fs::create_dir_all(&work_dir).map_err(|e| format!("mkdir work_dir: {}", e))?;

    let yaml = generate_config(tun_fd, socks_upstream, rules);
    let cfg_path = work_dir.join("config.yaml");
    fs::write(&cfg_path, &yaml).map_err(|e| format!("write config.yaml: {}", e))?;

    let mut cmd = Command::new(mihomo_path);
    cmd.arg("-d").arg(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // КРИТИЧНО: сохраняем TUN-fd в child под тем же номером. По умолчанию
    // std::process::Command ставит FD_CLOEXEC и fd закроется при exec.
    // Снимаем флаг руками в pre_exec callback (выполняется в child после fork,
    // до exec).
    let preserve_fd = tun_fd;
    unsafe {
        cmd.pre_exec(move || {
            let flags = libc::fcntl(preserve_fd, libc::F_GETFD);
            if flags < 0 {
                return Err(std::io::Error::last_os_error());
            }
            if libc::fcntl(preserve_fd, libc::F_SETFD, flags & !libc::FD_CLOEXEC) < 0 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }

    let mut child = cmd.spawn().map_err(|e| format!("spawn mihomo: {}", e))?;

    // Логи mihomo сольём в Android logcat best-effort. Берём stdout/stderr
    // полностью (take), Child всё равно kill+wait через PID.
    drain_to_log("mihomo-stdout", child.stdout.take());
    drain_to_log("mihomo-stderr", child.stderr.take());

    Ok(MihomoChild { child, work_dir })
}

fn drain_to_log<R: std::io::Read + Send + 'static>(_tag: &'static str, src: Option<R>) {
    let Some(mut src) = src else { return };
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match src.read(&mut buf) {
                Ok(0) | Err(_) => return,
                Ok(n) => {
                    // Пишем в stderr — Android logcat подхватывает stderr процесса.
                    let _ = std::io::stderr().write_all(&buf[..n]);
                }
            }
        }
    });
}

fn action_yaml(a: RoutingAction, has_proxy: bool) -> &'static str {
    match a {
        RoutingAction::Reject => "REJECT",
        RoutingAction::Direct => "DIRECT",
        // PROXY можно использовать только если есть socks-upstream + group PROXY.
        // Иначе гасим в DIRECT — иначе mihomo откажется парсить config.
        RoutingAction::Proxy => if has_proxy { "PROXY" } else { "DIRECT" },
    }
}

fn rules_to_yaml(rules: &[RoutingRule], has_proxy: bool) -> String {
    let default = if has_proxy { "PROXY" } else { "DIRECT" };
    let mut out = String::from("rules:\n");
    let mut had_fallback = false;
    for r in rules {
        match r {
            RoutingRule::DomainExact { domain, action } => {
                out.push_str(&format!("  - DOMAIN,{},{}\n", domain, action_yaml(*action, has_proxy)));
            }
            RoutingRule::DomainSuffix { suffix, action } => {
                out.push_str(&format!("  - DOMAIN-SUFFIX,{},{}\n", suffix, action_yaml(*action, has_proxy)));
            }
            RoutingRule::DomainKeyword { keyword, action } => {
                out.push_str(&format!("  - DOMAIN-KEYWORD,{},{}\n", keyword, action_yaml(*action, has_proxy)));
            }
            RoutingRule::IpCidr { cidr, action } => {
                out.push_str(&format!("  - IP-CIDR,{},{},no-resolve\n", cidr, action_yaml(*action, has_proxy)));
            }
            RoutingRule::ProcessName { name, action } => {
                // На Android mihomo PROCESS-NAME матчит package name (через
                // fd-сниффинг + reverse-lookup uid → pkg). Работает на API 28+.
                out.push_str(&format!("  - PROCESS-NAME,{},{}\n", name, action_yaml(*action, has_proxy)));
            }
            RoutingRule::Fallback { action } => {
                out.push_str(&format!("  - MATCH,{}\n", action_yaml(*action, has_proxy)));
                had_fallback = true;
            }
        }
    }
    if !had_fallback {
        out.push_str(&format!("  - MATCH,{}\n", default));
    }
    out
}

fn generate_config(tun_fd: RawFd, socks_upstream: Option<&str>, rules: &[RoutingRule]) -> String {
    let has_proxy = socks_upstream.is_some();
    let upstream_block = match socks_upstream {
        Some(addr) => {
            let (host, port) = addr.split_once(':').unwrap_or(("127.0.0.1", "1080"));
            format!(
                r#"proxies:
  - name: upstream
    type: socks5
    server: {host}
    port: {port}
    udp: true

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - upstream

{rules_yaml}"#,
                rules_yaml = rules_to_yaml(rules, true)
            )
        }
        None => {
            // Без socks-upstream — все PROXY-правила автоматически downgrade в DIRECT
            // (rules_to_yaml сам это делает). REJECT при этом всё равно работает —
            // полезно даже без upstream чтобы блокировать рекламу/трекеры.
            format!(
                r#"proxies: []

proxy-groups: []

{rules_yaml}"#,
                rules_yaml = rules_to_yaml(rules, false)
            )
        }
    };

    format!(
        r#"# Сгенерировано whisp-vpn-android — НЕ редактировать вручную.
# Минимальный mihomo-конфиг для Android: TUN на переданном fd, gVisor stack,
# без auto-route (этим занимается VpnService).
mixed-port: 0
allow-lan: false
log-level: warning
mode: rule

tun:
  enable: true
  stack: gvisor
  device: fd://{tun_fd}
  auto-route: false
  auto-detect-interface: false
  dns-hijack:
    - any:53

dns:
  enable: true
  listen: 127.0.0.1:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 1.1.1.1
    - 8.8.8.8

{upstream_block}
"#
    )
}
