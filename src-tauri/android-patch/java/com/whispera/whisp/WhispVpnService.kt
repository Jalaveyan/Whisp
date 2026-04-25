package com.whispera.whisp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log

/**
 * VpnService для Whisp на Android.
 *
 * Жизненный цикл:
 *  1. Пользователь жмёт Connect → Rust команда `connect` через JNI шлёт
 *     intent на этот сервис (с RoutingRule[] JSON в extra).
 *  2. onStartCommand → startVpn(): VpnService.Builder.establish() → fd.
 *  3. WhispVpnNative.nativeStart(fd, this, mihomoPath, rulesJson) →
 *     Rust spawn'ит mihomo с inherited fd.
 *  4. Каждый исходящий socket из mihomo НЕ зацикливается через TUN
 *     потому что builder.addDisallowedApplication(packageName) — наш UID
 *     всегда роутится в обычную сеть (Android 5+ feature, проще protect()).
 *
 * Foreground notification обязательна для Android 8+ (иначе сервис убьют).
 * Используем system Notification.Builder, а не androidx NotificationCompat —
 * последний требует доп. depend, которой в Tauri Android jniLibs нет.
 */
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

        // 1. Foreground notification — иначе Android прибьёт сервис в фоне.
        startForeground(NOTIFICATION_ID, buildNotification())

        // 2. VpnService.Builder — конфигурируем TUN-интерфейс.
        val builder = Builder()
            .setSession("Whisp VPN")
            .setMtu(1500)
            .addAddress("10.55.55.2", 24)
            .addRoute("0.0.0.0", 0)
            .addRoute("::", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")

        // Apps blacklist — наш собственный package иначе зациклимся.
        try {
            builder.addDisallowedApplication(packageName)
        } catch (e: Exception) {
            Log.w(TAG, "addDisallowedApplication failed: ${e.message}")
        }

        val pfd = builder.establish()
        if (pfd == null) {
            Log.e(TAG, "VpnService.Builder.establish() returned null — VPN не разрешён?")
            stopSelf()
            return
        }
        tunInterface = pfd

        // 3. Отдаём TUN fd + путь к mihomo + правила в Rust.
        val mihomoPath = "${applicationInfo.nativeLibraryDir}/libmihomo.so"
        Log.i(TAG, "mihomoPath=$mihomoPath rules=${pendingRulesJson.length}b")
        try {
            nativeHandle = WhispVpnNative.nativeStart(pfd.fd, this, mihomoPath, pendingRulesJson)
            if (nativeHandle == 0L) {
                Log.e(TAG, "nativeStart returned 0 — mihomo не запустился")
                stopVpn()
            } else {
                Log.i(TAG, "Rust core started, handle=$nativeHandle")
            }
        } catch (t: Throwable) {
            Log.e(TAG, "nativeStart failed", t)
            stopVpn()
        }
    }

    private fun stopVpn() {
        Log.i(TAG, "stopping VPN")
        if (nativeHandle != 0L) {
            try { WhispVpnNative.nativeStop(nativeHandle) } catch (_: Throwable) {}
            nativeHandle = 0L
        }
        tunInterface?.close()
        tunInterface = null
        // stopForeground(true) — deprecated после API 33 в пользу
        // STOP_FOREGROUND_REMOVE, но true всё ещё работает на всех уровнях.
        @Suppress("DEPRECATION")
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Whisp VPN",
                NotificationManager.IMPORTANCE_LOW
            )
            ch.description = "Notification while VPN is active"
            nm.createNotificationChannel(ch)
        }

        // Тап по нотификации — открыть основное окно приложения.
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pi = PendingIntent.getActivity(this, 0, launchIntent, piFlags)

        // System Notification.Builder вместо NotificationCompat.Builder —
        // не требует androidx, всегда доступен на Android API 11+.
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Whisp VPN")
            .setContentText("Подключено")
            .setSmallIcon(android.R.drawable.stat_sys_vpn_ic)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    /**
     * Вызывается из JNI (WhispVpnNative.protectSocket) для каждого
     * исходящего соединения mihomo. Сейчас не используется — мы полагаемся
     * на addDisallowedApplication(packageName), но оставляем как hook
     * на будущее (если перейдём на UID-based exclusion).
     */
    @Suppress("unused")
    fun protectFd(fd: Int): Boolean = protect(fd)
}
