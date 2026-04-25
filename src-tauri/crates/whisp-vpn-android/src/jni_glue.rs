//! JNI bindings. Компилируется только когда target=android + feature=jni-bindings.
//!
//! Kotlin side (schematically):
//!
//! ```kotlin
//! package com.whispera.whisp
//! object WhispVpnNative {
//!     init { System.loadLibrary("whisp_vpn_android") }
//!     external fun nativeInit(): Long
//!     external fun nativeLoadRules(handle: Long, rulesJson: String): Int
//!     external fun nativeFree(handle: Long)
//! }
//! ```
//!
//! Больше методов добавим когда начнём реально тянуть пакеты через TUN-fd.

use jni::objects::{JClass, JObject, JString};
use jni::sys::{jint, jlong};
use jni::JNIEnv;

use crate::VpnCore;

fn box_handle(core: VpnCore) -> jlong {
    Box::into_raw(Box::new(core)) as jlong
}

unsafe fn borrow_handle<'a>(handle: jlong) -> Option<&'a mut VpnCore> {
    if handle == 0 {
        return None;
    }
    (handle as *mut VpnCore).as_mut()
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeInit(
    _env: JNIEnv,
    _class: JClass,
) -> jlong {
    box_handle(VpnCore::new())
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeLoadRules(
    mut env: JNIEnv,
    _class: JClass,
    handle: jlong,
    rules_json: JString,
) -> jint {
    let Some(core) = (unsafe { borrow_handle(handle) }) else {
        return -1;
    };
    let Ok(s) = env.get_string(&rules_json) else {
        return -2;
    };
    let s: String = s.into();
    match core.load_rules_json(&s) {
        Ok(n) => n as jint,
        Err(_) => -3,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeFree(
    _env: JNIEnv,
    _class: JClass,
    handle: jlong,
) {
    if handle == 0 {
        return;
    }
    unsafe {
        drop(Box::from_raw(handle as *mut VpnCore));
    }
}

/// Запуск VPN-петли с уже полученным TUN-fd от VpnService.Builder.
/// Service-объект хранится для последующих вызовов protect().
///
/// Сейчас это no-op-шим: возвращаем фиктивный handle. Реальная имплементация
/// будет: spawn'ить thread, читать пакеты из TUN-fd, парсить IP header,
/// отдавать в RulesEngine, заворачивать выбранным transport. Подключение к
/// mihomo делается отдельным процессом (sidecar), пакеты в него отдаются
/// через TCP/UDP socket в loopback.
#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeStart(
    _env: JNIEnv,
    _class: JClass,
    tun_fd: jint,
    _service: JObject,
) -> jlong {
    eprintln!("[whisp-vpn-android] nativeStart fd={} (skeleton)", tun_fd);
    let core = VpnCore::new();
    Box::into_raw(Box::new(core)) as jlong
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeStop(
    _env: JNIEnv,
    _class: JClass,
    handle: jlong,
) -> jint {
    if handle == 0 {
        return 0;
    }
    unsafe { drop(Box::from_raw(handle as *mut VpnCore)) };
    eprintln!("[whisp-vpn-android] nativeStop");
    1
}
