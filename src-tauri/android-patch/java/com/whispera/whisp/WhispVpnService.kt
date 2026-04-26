package com.whispera.whisp

import android.content.Intent
import android.net.VpnService
import android.util.Log

class WhispVpnService : VpnService() {
    companion object {
        const val TAG = "WhispVpnService"
        const val ACTION_START = "com.whispera.whisp.ACTION_VPN_START"
        const val ACTION_STOP = "com.whispera.whisp.ACTION_VPN_STOP"
        const val EXTRA_RULES_JSON = "com.whispera.whisp.EXTRA_RULES_JSON"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "onStartCommand action=${intent?.action}")
        return START_NOT_STICKY
    }
}
