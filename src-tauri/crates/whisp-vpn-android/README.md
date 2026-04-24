# whisp-vpn-android

Rust-ядро VPN для Android. На desktop ту же задачу выполняет `mihomo` (sidecar); на
Android sidecars нельзя, поэтому VPN-функциональность живёт внутри APK.

## Статус

**Skeleton.** Есть:

- [src/rules.rs](src/rules.rs) — rules engine (`domain-suffix`, `domain-keyword`,
  `domain-exact`, `ip-cidr`, `process-name`, `fallback`). Порядок вычисления —
  последовательный, как в mihomo. Unit-тесты на порядок и матчинг доменов.
- [src/lib.rs](src/lib.rs) — `VpnCore` wrapper, `load_rules_json` из Kotlin.
- [src/jni_glue.rs](src/jni_glue.rs) — `Java_com_whispera_whisp_WhispVpnNative_*`
  экспорты. Собирается только на `target_os=android` + feature `jni-bindings`.

Нет (будет добавляться по мере необходимости):

- Packet parser (нужен, чтобы из raw-пакетов из TUN-fd доставать dst IP / SNI).
- Transport dispatcher (выбирает какой transport из `TransportType` применить
  для данного правила — mirage/vkwebrtc/phantom-http/...).
- Integration с реальными transport-реализациями из `Jalaveyan/Whispera` 
  (нужен ещё один crate-wrapper, чтобы переиспользовать Go-код через FFI,
  либо портировать transports в Rust).

## Почему отдельный crate

1. Чистый Rust, собирается и тестируется на любой ОС. `cargo test` работает
   на Windows dev-машине без Android NDK.
2. Не зависит от Tauri / mihomo / внутренностей `whisp` binary. Если завтра
   решим переключить desktop на тот же движок — просто подключим crate 
   как зависимость в `src-tauri/Cargo.toml` и удалим mihomo.
3. Явно видно что лежит в mobile-пути исполнения, без рисков затащить 
   windows-specific код (taskkill и т.п.).

## Kotlin side (скетч)

```kotlin
package com.whispera.whisp

object WhispVpnNative {
    init { System.loadLibrary("whisp_vpn_android") }
    external fun nativeInit(): Long
    external fun nativeLoadRules(handle: Long, rulesJson: String): Int
    external fun nativeFree(handle: Long)
}

class WhispVpnService : VpnService() {
    private var handle: Long = 0
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        handle = WhispVpnNative.nativeInit()
        WhispVpnNative.nativeLoadRules(handle, rulesJson())
        // дальше: Builder.establish() → pfd.fd → отдать в Rust, принимать пакеты обратно
        return START_STICKY
    }
    override fun onDestroy() {
        if (handle != 0L) WhispVpnNative.nativeFree(handle)
        super.onDestroy()
    }
}
```

## Build

```bash
# Юнит-тесты на dev машине (любой OS):
cargo test -p whisp-vpn-android

# Android: собирается в составе `tauri android build` (CI), когда в workspace
# будет прописана зависимость + cargo-ndk настроен в release workflow.
```

## Следующие шаги

1. Подключить crate в `src-tauri/Cargo.toml` как `[target.'cfg(target_os="android")'.dependencies]` → даст доступ к `VpnCore` из `lib.rs`.
2. Добавить Tauri command `android_vpn_connect(rules: String)` → frontend дёргает при клике Connect.
3. Написать минимальный `WhispVpnService.kt` в `src-tauri/gen/android/app/src/main/java/com/whispera/whisp/`.
4. Портировать пакет-парсер (IPv4/IPv6 header + UDP/TCP payload, SNI extractor).
5. Подключить первый transport — скорее всего phantom-http как самый простой.
