package com.whispera.whisp

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

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.decorView.post {
                val h = window.decorView.height
                // 60dp exclusion zone covers the left-edge system back gesture on all densities
                val exclusionPx = (60 * resources.displayMetrics.density + 0.5f).toInt()
                window.systemGestureExclusionRects = listOf(Rect(0, 0, exclusionPx, h))
            }
        }
    }
}
