package com.whispera.whisp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.util.Log
import android.widget.Toast

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

    private val mainHandler = Handler(Looper.getMainLooper())
    private fun toast(msg: String) {
        Log.i(TAG, msg)
        mainHandler.post { Toast.makeText(this, "Whisp VPN: $msg", Toast.LENGTH_LONG).show() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            when (intent?.action) {
                ACTION_STOP -> { stopVpn(); return START_NOT_STICKY }
                else -> {
                    pendingRulesJson = intent?.getStringExtra(EXTRA_RULES_JSON) ?: "[]"
                    startVpnSafe()
                }
            }
        } catch (t: Throwable) {
            toast("crash: ${t.javaClass.simpleName}: ${t.message}")
            try { stopForegroundCompat() } catch (_: Throwable) {}
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startVpnSafe() {
        toast("starting")

        val prepareIntent = try { VpnService.prepare(this) } catch (t: Throwable) {
            toast("prepare failed: ${t.message}"); stopSelf(); return
        }
        if (prepareIntent != null) {
            toast("VPN permission not granted"); stopSelf(); return
        }

        try { startForegroundCompat() } catch (t: Throwable) {
            toast("startForeground failed: ${t.message}"); stopSelf(); return
        }

        val pfd = try {
            Builder()
                .setSession("Whisp VPN")
                .setMtu(1500)
                .addAddress("10.55.55.2", 24)
                .addRoute("0.0.0.0", 0)
                .addRoute("::", 0)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .also { try { it.addDisallowedApplication(packageName) } catch (_: Throwable) {} }
                .establish()
        } catch (t: Throwable) {
            toast("establish crashed: ${t.message}"); stopVpn(); return
        }
        if (pfd == null) { toast("establish returned null"); stopVpn(); return }
        tunInterface = pfd
        toast("TUN fd=${pfd.fd} OK")

        val mihomoPath = applicationInfo.nativeLibraryDir + "/libmihomo.so"
        val mihomoExists = java.io.File(mihomoPath).exists()
        toast("mihomo at $mihomoPath (exists=$mihomoExists)")
        if (!mihomoExists) {
            toast("mihomo binary missing — check externalBin in tauri.android.conf.json")
            stopVpn(); return
        }

        try {
            nativeHandle = WhispVpnNative.nativeStart(pfd.fd, this, mihomoPath, pendingRulesJson)
            if (nativeHandle == 0L) {
                toast("nativeStart returned 0 (mihomo spawn failed — likely SELinux/exec restriction)")
                stopVpn()
            } else {
                toast("mihomo started, handle=$nativeHandle")
            }
        } catch (t: Throwable) {
            toast("nativeStart crashed: ${t.javaClass.simpleName}: ${t.message}"); stopVpn()
        }
    }

    private fun startForegroundCompat() {
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notif,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notif)
        }
    }

    private fun stopForegroundCompat() {
        @Suppress("DEPRECATION") stopForeground(true)
    }

    private fun stopVpn() {
        Log.i(TAG, "stopVpn")
        if (nativeHandle != 0L) {
            try { WhispVpnNative.nativeStop(nativeHandle) } catch (_: Throwable) {}
            nativeHandle = 0L
        }
        try { tunInterface?.close() } catch (_: Throwable) {}
        tunInterface = null
        try { stopForegroundCompat() } catch (_: Throwable) {}
        stopSelf()
    }

    override fun onDestroy() {
        try { stopVpn() } catch (_: Throwable) {}
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(CHANNEL_ID, "Whisp VPN", NotificationManager.IMPORTANCE_LOW)
            nm.createNotificationChannel(ch)
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(this)
        }
        return builder
            .setContentTitle("Whisp VPN")
            .setContentText("Connected")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
