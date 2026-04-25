//! JNI bindings. Компилируется только когда target=android + feature=jni-bindings.
//!
//! Kotlin side (схематично):
//!
//! ```kotlin
//! object WhispVpnNative {
//!     init { System.loadLibrary("whisp_vpn_android") }
//!     external fun nativeInit(): Long
//!     external fun nativeStart(tunFd: Int, service: WhispVpnService, mihomoPath: String): Long
//!     external fun nativeStop(handle: Long): Int
//!     external fun nativeFree(handle: Long)
//! }
//! ```

use jni::objects::{JClass, JObject, JString};
use jni::sys::{jint, jlong};
use jni::JNIEnv;
use std::path::PathBuf;

use crate::mihomo_runner::{spawn_mihomo, MihomoChild};
use crate::VpnCore;

/// Хэндл, который мы возвращаем в Kotlin как jlong.
/// Содержит VpnCore (rules) + дочерний mihomo, чтобы nativeStop корректно
/// его остановил.
struct VpnSession {
    _core: VpnCore,
    mihomo: Option<MihomoChild>,
}

fn box_handle(s: VpnSession) -> jlong {
    Box::into_raw(Box::new(s)) as jlong
}

unsafe fn borrow_handle<'a>(handle: jlong) -> Option<&'a mut VpnSession> {
    if handle == 0 {
        return None;
    }
    (handle as *mut VpnSession).as_mut()
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeInit(
    _env: JNIEnv,
    _class: JClass,
) -> jlong {
    box_handle(VpnSession {
        _core: VpnCore::new(),
        mihomo: None,
    })
}

#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeLoadRules(
    mut env: JNIEnv,
    _class: JClass,
    handle: jlong,
    rules_json: JString,
) -> jint {
    let Some(session) = (unsafe { borrow_handle(handle) }) else {
        return -1;
    };
    let Ok(s) = env.get_string(&rules_json) else {
        return -2;
    };
    let s: String = s.into();
    match session._core.load_rules_json(&s) {
        Ok(n) => n as jint,
        Err(_) => -3,
    }
}

/// Запуск VPN с уже полученным TUN-fd от VpnService.Builder.
/// Spawn'ит mihomo с inherited fd, возвращает handle.
///
/// Параметры:
/// - tun_fd: fd от ParcelFileDescriptor.getFd()
/// - _service: WhispVpnService (зарезервирован для protect()-callback в будущем)
/// - mihomo_path: полный путь к бинарю — обычно nativeLibraryDir/libmihomo.so
#[no_mangle]
pub extern "system" fn Java_com_whispera_whisp_WhispVpnNative_nativeStart(
    mut env: JNIEnv,
    _class: JClass,
    tun_fd: jint,
    _service: JObject,
    mihomo_path: JString,
) -> jlong {
    let path_str: String = match env.get_string(&mihomo_path) {
        Ok(s) => s.into(),
        Err(e) => {
            eprintln!("[whisp-vpn-android] mihomo_path get_string failed: {}", e);
            return 0;
        }
    };
    let mihomo_path = PathBuf::from(path_str);
    eprintln!(
        "[whisp-vpn-android] nativeStart fd={} mihomo={}",
        tun_fd,
        mihomo_path.display()
    );

    // socks_upstream=None — smoke режим, MATCH,DIRECT. Когда подвезём go-client
    // как локальный socks5, передадим Some("127.0.0.1:1080").
    let mihomo = match spawn_mihomo(&mihomo_path, tun_fd as std::os::unix::io::RawFd, None) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[whisp-vpn-android] spawn_mihomo failed: {}", e);
            return 0;
        }
    };
    eprintln!("[whisp-vpn-android] mihomo spawned pid={}", mihomo.child.id());

    box_handle(VpnSession {
        _core: VpnCore::new(),
        mihomo: Some(mihomo),
    })
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
    let mut session = unsafe { Box::from_raw(handle as *mut VpnSession) };
    if let Some(mut m) = session.mihomo.take() {
        m.kill();
    }
    eprintln!("[whisp-vpn-android] nativeStop done");
    1
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
    let mut session = unsafe { Box::from_raw(handle as *mut VpnSession) };
    if let Some(mut m) = session.mihomo.take() {
        m.kill();
    }
}
