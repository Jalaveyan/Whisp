use std::io::Write;
use std::path::Path;
use std::process::{Child, Command, Stdio};

pub struct GoClientChild { pub child: Child }

impl GoClientChild {
    pub fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn spawn_go_client(
    bin_path: &Path,
    conn_key: &str,
    socks_addr: &str,
) -> Result<GoClientChild, String> {
    if !bin_path.exists() {
        return Err(format!("go-client not found at {}", bin_path.display()));
    }
    let mut cmd = Command::new(bin_path);
    cmd.arg("-key").arg(conn_key)
        .arg("-socks").arg(socks_addr)
        .arg("-no-tun")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("spawn go-client: {}", e))?;
    if let Some(s) = child.stdout.take() { drain(s) }
    if let Some(s) = child.stderr.take() { drain(s) }
    Ok(GoClientChild { child })
}

fn drain<R: std::io::Read + Send + 'static>(mut src: R) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match src.read(&mut buf) {
                Ok(0) | Err(_) => return,
                Ok(n) => { let _ = std::io::stderr().write_all(&buf[..n]); }
            }
        }
    });
}

/// Опрашивает 127.0.0.1:port пока go-client не откроет SOCKS5 listener.
/// Полезно перед стартом mihomo чтобы upstream уже был готов.
pub fn wait_socks_ready(addr: &str, max_ms: u64) -> bool {
    use std::net::TcpStream;
    use std::time::{Duration, Instant};
    let deadline = Instant::now() + Duration::from_millis(max_ms);
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &addr.parse().unwrap_or("127.0.0.1:1080".parse().unwrap()),
            Duration::from_millis(200),
        ).is_ok() { return true; }
        std::thread::sleep(Duration::from_millis(150));
    }
    false
}
