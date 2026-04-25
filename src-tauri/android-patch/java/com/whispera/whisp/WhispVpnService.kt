package com.whispera.whisp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * VpnService для Whisp на Android.
 *
 * Жизненный цикл:
 *  1. Пользователь жмёт Connect → Rust команда `connect` дёргает
 *     `WhispVpnNative.startVpn(applicationContext)` (через JNI).
 *  2. Native слой запускает intent на этот сервис, передаёт сюда
 *     mihomo-config (yaml) и пути sidecars.
 *  3. Сервис строит TUN через VpnService.Builder, получает fd,
 *     пробрасывает fd обратно в Rust через `WhispVpnNative.attachTunFd(fd)`.
 *  4. Rust запускает mihomo с `tun.device: fd://N` либо с gVisor stack.
 *  5. Каждый исходящий socket из mihomo — protect()'ится этим сервисом
 *     (через JNI callback `protectSocket(fd)`), иначе зацикливается.
 *
 * Foreground notification обязательна для Android 8+ (иначе сервис убьют).
 */
class WhispVpnService : VpnService() {
    companion object {
        const val TAG = "WhispVpnService"
        const val ACTION_START = "com.whispera.whisp.ACTION_VPN_START"
        const val ACTION_STOP = "com.whispera.whisp.ACTION_VPN_STOP"
        const val NOTIFICATION_ID = 17
        const val CHANNEL_ID = "whisp_vpn_channel"
    }

    private var tunInterface: ParcelFileDescriptor? = null
    private var nativeHandle: Long = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopVpn(); return START_NOT_STICKY }
            else -> startVpn()
        }
        return START_STICKY
    }

    private fun startVpn() {
        Log.i(TAG, "starting VPN")

        // 1. Foreground notification — иначе Android прибьёт сервис в фоне.
        startForeground(NOTIFICATION_ID, buildNotification())

        // 2. VpnService.Builder — конфигурируем TUN-интерфейс.
        // Routes/DNS будем уточнять/обновлять из Rust по rules engine.
        val builder = Builder()
            .setSession("Whisp VPN")
            .setMtu(1500)
            .addAddress("10.55.55.2", 24)
            .addRoute("0.0.0.0", 0)        // весь IPv4 трафик через TUN
            .addRoute("::", 0)             // и IPv6
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

        // 3. Отдаём TUN fd в Rust. Native слой знает как запустить mihomo
        // и подцепить сокеты к protect()-callback (через WhispVpnNative.protectSocket).
        try {
            nativeHandle = WhispVpnNative.nativeStart(pfd.fd, this)
            Log.i(TAG, "Rust core started, handle=$nativeHandle")
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
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Whisp VPN",
                NotificationManager.IMPORTANCE_LOW
            )
            ch.description = "Notification while VPN is active"
            nm.createNotificationChannel(ch)
        }

        // Тап по нотификации — открыть основное окно приложения (MainActivity Tauri'а).
        val pi = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Whisp VPN")
            .setContentText("Подключено")
            .setSmallIcon(android.R.drawable.stat_sys_vpn_ic)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    /**
     * Вызывается из JNI (WhispVpnNative.protectSocket(fd)) для каждого
     * исходящего соединения mihomo. Без этого пакеты от mihomo пойдут
     * обратно в TUN и образуют петлю.
     */
    fun protectFd(fd: Int): Boolean = protect(fd)
}
