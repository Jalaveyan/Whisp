package com.whispera.whisp

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
}
