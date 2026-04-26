package com.whispera.whisp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log

class WhispVpnService : VpnService() {
    companion object {
        const val TAG = "WhispVpnService"
        const val ACTION_START = "com.whispera.whisp.ACTION_VPN_START"
        const val ACTION_STOP = "com.whispera.whisp.ACTION_VPN_STOP"
        const val EXTRA_RULES_JSON = "com.whispera.whisp.EXTRA_RULES_JSON"
        const val NOTIFICATION_ID = 17
        const val CHANNEL_ID = "whisp_vpn_channel"
    }

    private var tunInterface: ParcelFileDescriptor? = null
    private var nativeHandle: Long = 0L
    private var pendingRulesJson: String = "[]"

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopVpn(); return START_NOT_STICKY }
            else -> {
                pendingRulesJson = intent?.getStringExtra(EXTRA_RULES_JSON) ?: "[]"
                startVpn()
            }
        }
        return START_STICKY
    }

    private fun startVpn() {
        Log.i(TAG, "starting VPN")
        startForeground(NOTIFICATION_ID, buildNotification())

        val builder = Builder()
            .setSession("Whisp VPN")
            .setMtu(1500)
            .addAddress("10.55.55.2", 24)
            .addRoute("0.0.0.0", 0)
            .addRoute("::", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")
        try { builder.addDisallowedApplication(packageName) } catch (_: Exception) {}

        val pfd = builder.establish()
        if (pfd == null) {
            Log.e(TAG, "establish() returned null")
            stopSelf()
            return
        }
        tunInterface = pfd

        val mihomoPath = applicationInfo.nativeLibraryDir + "/libmihomo.so"
        try {
            nativeHandle = WhispVpnNative.nativeStart(pfd.fd, this, mihomoPath, pendingRulesJson)
            if (nativeHandle == 0L) { Log.e(TAG, "nativeStart returned 0"); stopVpn() }
        } catch (t: Throwable) {
            Log.e(TAG, "nativeStart failed", t)
            stopVpn()
        }
    }

    private fun stopVpn() {
        if (nativeHandle != 0L) {
            try { WhispVpnNative.nativeStop(nativeHandle) } catch (_: Throwable) {}
            nativeHandle = 0L
        }
        tunInterface?.close()
        tunInterface = null
        @Suppress("DEPRECATION")
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() { stopVpn(); super.onDestroy() }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(CHANNEL_ID, "Whisp VPN", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(ch)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Whisp VPN")
            .setContentText("Connected")
            .setSmallIcon(android.R.drawable.stat_sys_vpn_ic)
            .setOngoing(true)
            .build()
    }
}
