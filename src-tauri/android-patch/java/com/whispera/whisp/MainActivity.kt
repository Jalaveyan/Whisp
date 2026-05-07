package com.whispera.whisp

import android.app.Activity
import android.content.Intent
import android.graphics.Rect
import android.os.Bundle

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WhispVpnPrep.setActivity(this)
    }

    override fun onDestroy() {
        WhispVpnPrep.setActivity(null)
        super.onDestroy()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == WhispVpnPrep.REQ_CODE && resultCode == Activity.RESULT_OK) {
            // VPN permission granted — auto-start with params saved before the dialog
            WhispVpnPrep.startPending(this)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.decorView.post {
                val h = window.decorView.height
                val exclusionPx = (60 * resources.displayMetrics.density + 0.5f).toInt()
                window.systemGestureExclusionRects = listOf(Rect(0, 0, exclusionPx, h))
            }
        }
    }
}
