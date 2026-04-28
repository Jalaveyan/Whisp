package com.whispera.whisp

object WhispVpnNative {
    // JNI exports whisp-vpn-android crate'а компилируются ВНУТРЬ whisp_lib.so
    // (через Cargo dep), отдельной libwhisp_vpn_android.so нет. Tauri уже
    // подгружает whisp_lib из WryActivity, повторный loadLibrary — no-op.
    init { System.loadLibrary("whisp_lib") }
    @JvmStatic external fun nativeInit(): Long
    @JvmStatic external fun nativeStart(tunFd: Int, service: WhispVpnService, mihomoPath: String, rulesJson: String): Long
    @JvmStatic external fun nativeStop(handle: Long): Int
    @JvmStatic external fun nativeFree(handle: Long)
}
