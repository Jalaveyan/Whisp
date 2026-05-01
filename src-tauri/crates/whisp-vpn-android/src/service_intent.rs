//! Отправка intent на WhispVpnService.ACTION_START / ACTION_STOP.
//!
//! Без этого Connect-кнопка ни к чему не подключена: Kotlin-сервис написан,
//! permission в манифесте есть, но никто не запускает сервис.
//!
//! Контекст и JavaVM достаём через ndk_context — Tauri 2 на Android их
//! инициализирует в своём JNI_OnLoad, так что здесь просто читаем готовое.
//!
//! Скомпилируется только под `target_os = "android"`. На desktop тушится
//! через cfg в lib.rs.

use jni::objects::{JObject, JValue};
use jni::JavaVM;
use std::sync::atomic::{AtomicBool, Ordering};

static VPN_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn is_vpn_active() -> bool { VPN_ACTIVE.load(Ordering::SeqCst) }
pub fn set_vpn_active(v: bool) { VPN_ACTIVE.store(v, Ordering::SeqCst); }

const SERVICE_CLASS: &str = "com/whispera/whisp/WhispVpnService";
const ACTION_START: &str = "com.whispera.whisp.ACTION_VPN_START";
const ACTION_STOP: &str = "com.whispera.whisp.ACTION_VPN_STOP";
const EXTRA_RULES_JSON: &str = "com.whispera.whisp.EXTRA_RULES_JSON";
const EXTRA_CONN_KEY: &str = "com.whispera.whisp.EXTRA_CONN_KEY";

fn vm_and_ctx() -> Result<(JavaVM, *mut std::ffi::c_void), String> {
    // SAFETY: ndk_context::android_context() возвращает указатели,
    // которые валидны до выгрузки приложения. JavaVM::from_raw — unsafe,
    // потому что нужно гарантировать, что ndk_context уже инициализирован
    // (Tauri 2 это делает).
    let ctx = ndk_context::android_context();
    if ctx.vm().is_null() || ctx.context().is_null() {
        return Err("ndk_context not initialized (no VM/Context)".to_string());
    }
    let vm = unsafe { JavaVM::from_raw(ctx.vm() as *mut _) }
        .map_err(|e| format!("JavaVM::from_raw: {}", e))?;
    Ok((vm, ctx.context()))
}

fn send_action(action: &str, rules_json: Option<&str>, conn_key: Option<&str>, stop: bool) -> Result<(), String> {
    let (vm, ctx_ptr) = vm_and_ctx()?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {}", e))?;

    let context = unsafe { JObject::from_raw(ctx_ptr as jni::sys::jobject) };

    // ClassLoader app_loader = context.getClassLoader()
    // Без этого find_class из non-Java thread'а не находит наши Kotlin-классы:
    // JVM использует system loader, а наши классы только в app's DEX.
    let app_loader = env
        .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
        .and_then(|v| v.l())
        .map_err(|e| format!("getClassLoader: {}", e))?;
    let svc_name = env
        .new_string(SERVICE_CLASS.replace('/', "."))
        .map_err(|e| format!("new_string svc: {}", e))?;
    let svc_class = env
        .call_method(
            &app_loader,
            "loadClass",
            "(Ljava/lang/String;)Ljava/lang/Class;",
            &[JValue::Object(&svc_name.into())],
        )
        .and_then(|v| v.l())
        .map_err(|e| format!("loadClass {}: {}", SERVICE_CLASS, e))?;

    let intent_class = env
        .find_class("android/content/Intent")
        .map_err(|e| format!("find_class Intent: {}", e))?;
    let intent = env
        .new_object(
            &intent_class,
            "(Landroid/content/Context;Ljava/lang/Class;)V",
            &[JValue::Object(&context), JValue::Object(&svc_class)],
        )
        .map_err(|e| format!("new Intent: {}", e))?;

    // intent.setAction(action)
    let action_jstr = env
        .new_string(action)
        .map_err(|e| format!("new_string action: {}", e))?;
    env.call_method(
        &intent,
        "setAction",
        "(Ljava/lang/String;)Landroid/content/Intent;",
        &[JValue::Object(&action_jstr.into())],
    )
    .map_err(|e| format!("setAction: {}", e))?;

    let mut put_extra = |k: &str, v: &str| -> Result<(), String> {
        let kj = env.new_string(k).map_err(|e| e.to_string())?;
        let vj = env.new_string(v).map_err(|e| e.to_string())?;
        env.call_method(
            &intent,
            "putExtra",
            "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
            &[JValue::Object(&kj.into()), JValue::Object(&vj.into())],
        )
        .map_err(|e| format!("putExtra {}: {}", k, e))?;
        Ok(())
    };
    if let Some(rules) = rules_json { put_extra(EXTRA_RULES_JSON, rules)?; }
    if let Some(key) = conn_key { put_extra(EXTRA_CONN_KEY, key)?; }

    if stop {
        // stopService безопасен даже если сервис уже мёртв.
        env.call_method(
            &context,
            "stopService",
            "(Landroid/content/Intent;)Z",
            &[JValue::Object(&intent)],
        )
        .map_err(|e| format!("stopService: {}", e))?;
    } else {
        // VPN всегда foreground (Android 8+ убьёт обычный сервис в фоне).
        env.call_method(
            &context,
            "startForegroundService",
            "(Landroid/content/Intent;)Landroid/content/ComponentName;",
            &[JValue::Object(&intent)],
        )
        .map_err(|e| format!("startForegroundService: {}", e))?;
    }

    Ok(())
}

pub fn start_vpn_service(rules_json: &str, conn_key: &str) -> Result<(), String> {
    let r = send_action(ACTION_START, Some(rules_json), Some(conn_key), false);
    if r.is_ok() { set_vpn_active(true); }
    r
}

pub fn stop_vpn_service() -> Result<(), String> {
    let r = send_action(ACTION_STOP, None, None, true);
    set_vpn_active(false);
    r
}

const PREP_CLASS: &str = "com/whispera/whisp/WhispVpnPrep";

/// Возвращает true если VPN permission уже выдан, false — нужно вызвать request_vpn_permission.
pub fn is_vpn_prepared() -> Result<bool, String> {
    let (vm, ctx_ptr) = vm_and_ctx()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx_ptr as jni::sys::jobject) };
    let app_loader = env
        .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
        .and_then(|v| v.l())
        .map_err(|e| format!("getClassLoader: {}", e))?;
    let cls_name = env
        .new_string(PREP_CLASS.replace('/', "."))
        .map_err(|e| e.to_string())?;
    let cls = env
        .call_method(
            &app_loader,
            "loadClass",
            "(Ljava/lang/String;)Ljava/lang/Class;",
            &[JValue::Object(&cls_name.into())],
        )
        .and_then(|v| v.l())
        .map_err(|e| format!("loadClass {}: {}", PREP_CLASS, e))?;
    let cls_class: jni::objects::JClass = cls.into();
    let result = env
        .call_static_method(&cls_class, "isPrepared", "()Z", &[])
        .and_then(|v| v.z())
        .map_err(|e| format!("isPrepared: {}", e))?;
    Ok(result)
}

/// Открывает системный диалог 'Allow VPN'. Возвращает Ok(true) если диалог
/// показан/уже approved, Err при отсутствии MainActivity.
pub fn request_vpn_permission() -> Result<i32, String> {
    let (vm, ctx_ptr) = vm_and_ctx()?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { JObject::from_raw(ctx_ptr as jni::sys::jobject) };
    let app_loader = env
        .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
        .and_then(|v| v.l())
        .map_err(|e| format!("getClassLoader: {}", e))?;
    let cls_name = env
        .new_string(PREP_CLASS.replace('/', "."))
        .map_err(|e| e.to_string())?;
    let cls = env
        .call_method(
            &app_loader,
            "loadClass",
            "(Ljava/lang/String;)Ljava/lang/Class;",
            &[JValue::Object(&cls_name.into())],
        )
        .and_then(|v| v.l())
        .map_err(|e| format!("loadClass {}: {}", PREP_CLASS, e))?;
    let cls_class: jni::objects::JClass = cls.into();
    let result = env
        .call_static_method(&cls_class, "requestPermission", "()I", &[])
        .and_then(|v| v.i())
        .map_err(|e| format!("requestPermission: {}", e))?;
    Ok(result)
}
