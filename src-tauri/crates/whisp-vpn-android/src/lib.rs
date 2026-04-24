//! Whisp VPN core для Android.
//!
//! Общая стратегия: на desktop роутингом занимается mihomo (TUN + rules);
//! на Android нельзя запустить sidecar-демон — VPN-функциональность реализуется
//! внутри приложения через `android.net.VpnService`. Этот crate содержит
//! платформо-независимое ядро (rules engine + transport dispatcher) и JNI-мост,
//! через который Kotlin/Java слой отдаёт нам raw-пакеты из TUN-fd и принимает
//! обратно отправленные пакеты.
//!
//! Статус: skeleton. Настоящая логика роутинга будет добавляться по мере
//! миграции правил из mihomo config в нативный код.
//!
//! Не зависит от mihomo — чистый Rust, чтобы тестировать и на desktop.

mod rules;

pub use rules::{RoutingAction, RoutingRule, RulesEngine};

#[cfg(all(target_os = "android", feature = "jni-bindings"))]
mod jni_glue;

/// Публичная точка входа для инициализации VPN-ядра.
/// На Android вызывается из Kotlin через JNI после `VpnService.Builder.establish()`.
/// На desktop — тесты / dev-smoke.
pub struct VpnCore {
    rules: RulesEngine,
}

impl VpnCore {
    pub fn new() -> Self {
        Self {
            rules: RulesEngine::new(),
        }
    }

    pub fn load_rules_json(&mut self, json: &str) -> Result<usize, String> {
        self.rules.load_from_json(json)
    }

    pub fn rules(&self) -> &RulesEngine {
        &self.rules
    }
}

impl Default for VpnCore {
    fn default() -> Self {
        Self::new()
    }
}
