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
import singbox.Singbox

class WhispVpnService : VpnService() {
    companion object {
        const val TAG = "WhispVpnService"
        const val ACTION_START = "com.whispera.whisp.ACTION_VPN_START"
        const val ACTION_STOP  = "com.whispera.whisp.ACTION_VPN_STOP"
        const val EXTRA_CONN_KEY = "com.whispera.whisp.EXTRA_CONN_KEY"
        const val NOTIFICATION_ID = 17
        const val CHANNEL_ID = "whisp_vpn_channel"
    }

    private var tunInterface: ParcelFileDescriptor? = null
    private var goClientProc: Process? = null
    private var singBoxRunning = false
    private var pendingConnKey: String = ""

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
                    pendingConnKey = intent?.getStringExtra(EXTRA_CONN_KEY) ?: ""
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

        if (VpnService.prepare(this) != null) {
            toast("VPN permission not granted"); stopSelf(); return
        }

        try { startForegroundCompat() } catch (t: Throwable) {
            toast("startForeground: ${t.message}"); stopSelf(); return
        }

        val pfd = try {
            Builder()
                .setSession("Whisp VPN")
                .setMtu(9000)
                .addAddress("172.19.0.1", 30)
                .addRoute("0.0.0.0", 0)
                .addRoute("::", 0)
                .addDnsServer("1.1.1.1")
                .also { try { it.addDisallowedApplication(packageName) } catch (_: Throwable) {} }
                .establish()
        } catch (t: Throwable) {
            toast("establish: ${t.message}"); stopVpn(); return
        } ?: run { toast("establish returned null"); stopVpn(); return }

        tunInterface = pfd
        toast("TUN fd=${pfd.fd}")

        // 1. Запускаем go-client как SOCKS5 upstream на :1080
        val libDir = applicationInfo.nativeLibraryDir
        val goClientPath = "$libDir/libwhispera-go-client.so"
        if (pendingConnKey.isNotEmpty() && java.io.File(goClientPath).exists()) {
            try {
                goClientProc = ProcessBuilder(goClientPath,
                    "-key", pendingConnKey,
                    "-socks", "127.0.0.1:1080",
                    "-no-tun")
                    .redirectErrorStream(true)
                    .start()
                Thread.sleep(800) // дать go-client подняться
                toast("go-client started")
            } catch (t: Throwable) {
                toast("go-client failed: ${t.message}")
            }
        }

        // 2. Запускаем sing-box через gomobile AAR
        val config = buildSingBoxConfig(
            socksAddr = if (goClientProc != null) "127.0.0.1" else null,
            socksPort = 1080
        )

        try {
            val workDir = filesDir.absolutePath
            Log.i(TAG, "sing-box workDir=$workDir config: $config")
            Singbox.start(pfd.fd.toLong(), workDir, config)
            singBoxRunning = true
            toast("VPN started")
        } catch (t: Throwable) {
            Log.e(TAG, "sing-box FATAL: ${t.stackTraceToString()}")
            toast("sing-box: ${t.javaClass.simpleName}: ${t.message ?: t.toString()}")
            stopVpn()
        }
    }

    private fun buildSingBoxConfig(socksAddr: String?, socksPort: Int): String {
        val outbounds = buildString {
            append("""{"type":"direct","tag":"direct"}""")
            if (socksAddr != null) {
                append(""",{"type":"socks","tag":"proxy","server":"$socksAddr","server_port":$socksPort,"version":"5"}""")
            }
        }
        val finalOut = if (socksAddr != null) "proxy" else "direct"

        return """
        {
          "log": {"level": "debug"},
          "dns": {
            "servers": [
              {"tag":"remote","address":"tls://1.1.1.1","detour":"$finalOut"},
              {"tag":"local","address":"local","detour":"direct"}
            ],
            "rules": [{"outbound":"any","server":"local"}],
            "fakeip": {
              "enabled": true,
              "inet4_range": "198.18.0.0/15"
            },
            "strategy": "prefer_ipv4"
          },
          "inbounds": [{
            "type": "tun",
            "tag": "tun-in",
            "address": ["172.19.0.1/30"],
            "mtu": 9000,
            "auto_route": false,
            "stack": "gvisor",
            "sniff": true,
            "sniff_override_destination": true
          }],
          "outbounds": [$outbounds],
          "route": {
            "final": "$finalOut",
            "auto_detect_interface": false
          },
          "experimental": {
            "cache_file": {
              "enabled": false
            }
          }
        }
        """.trimIndent()
    }

    private fun stopVpn() {
        Log.i(TAG, "stopVpn")
        if (singBoxRunning) {
            try { Singbox.stop() } catch (_: Throwable) {}
            singBoxRunning = false
        }
        goClientProc?.destroy()
        goClientProc = null
        try { tunInterface?.close() } catch (_: Throwable) {}
        tunInterface = null
        try { stopForegroundCompat() } catch (_: Throwable) {}
        stopSelf()
    }

    override fun onDestroy() {
        try { stopVpn() } catch (_: Throwable) {}
        super.onDestroy()
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

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Whisp VPN", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(this, CHANNEL_ID)
        else
            @Suppress("DEPRECATION") Notification.Builder(this)
        return builder
            .setContentTitle("Whisp VPN")
            .setContentText("Connected")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .build()
    }
}
