package com.whispera.whisp

/**
 * JNI-обвязка вокруг Rust-ядра (crate `whisp-vpn-android`).
 *
 * libwhisp_vpn_android.so собирается cargo-ndk и пакуется в jniLibs/arm64-v8a/
 * (см. release.yml Android job + tauri.conf.json).
 *
 * Контракт с Rust:
 *  - nativeInit / nativeFree — управление Box<VpnCore> handle.
 *  - nativeLoadRules — JSON правил из mihomo-config / Tauri command.
 *  - nativeStart(fd, service) — запустить packet-pump на полученном TUN-fd
 *    с обратной ссылкой на сервис, чтобы можно было звать protectSocket.
 *  - nativeStop(handle) — остановить.
 *
 * Метод `protectSocket` — JNI -> Kotlin call обратно: нужно для Rust,
 * чтобы каждый создаваемый upstream-сокет в mihomo помечался "не петлять
 * обратно в TUN". См. WhispVpnService.protectFd(fd).
 */
object WhispVpnNative {
    init { System.loadLibrary("whisp_vpn_android") }

    @JvmStatic external fun nativeInit(): Long
    @JvmStatic external fun nativeLoadRules(handle: Long, rulesJson: String): Int
    /** Запуск VPN: получает TUN fd, ссылку на сервис (для будущего protect() callback)
     *  и полный путь к бинарю mihomo в nativeLibraryDir. Возвращает handle или 0 при ошибке. */
    @JvmStatic external fun nativeStart(tunFd: Int, service: WhispVpnService, mihomoPath: String): Long
    @JvmStatic external fun nativeStop(handle: Long): Int
    @JvmStatic external fun nativeFree(handle: Long)
}
