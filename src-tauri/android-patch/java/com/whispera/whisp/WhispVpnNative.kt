package com.whispera.whisp

object WhispVpnNative {
    init { System.loadLibrary("whisp_vpn_android") }
    @JvmStatic external fun nativeInit(): Long
    @JvmStatic external fun nativeStart(tunFd: Int, service: WhispVpnService, mihomoPath: String, rulesJson: String): Long
    @JvmStatic external fun nativeStop(handle: Long): Int
    @JvmStatic external fun nativeFree(handle: Long)
}
