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

const SERVICE_CLASS: &str = "com/whispera/whisp/WhispVpnService";
const ACTION_START: &str = "com.whispera.whisp.ACTION_VPN_START";
const ACTION_STOP: &str = "com.whispera.whisp.ACTION_VPN_STOP";
const EXTRA_RULES_JSON: &str = "com.whispera.whisp.EXTRA_RULES_JSON";

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

fn send_action(action: &str, rules_json: Option<&str>) -> Result<(), String> {
    let (vm, ctx_ptr) = vm_and_ctx()?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {}", e))?;

    let context = unsafe { JObject::from_raw(ctx_ptr as jni::sys::jobject) };

    // Class<WhispVpnService>
    let svc_class = env
        .find_class(SERVICE_CLASS)
        .map_err(|e| format!("find_class {}: {}", SERVICE_CLASS, e))?;

    // Intent intent = new Intent(context, WhispVpnService.class)
    let intent_class = env
        .find_class("android/content/Intent")
        .map_err(|e| format!("find_class Intent: {}", e))?;
    let intent = env
        .new_object(
            &intent_class,
            "(Landroid/content/Context;Ljava/lang/Class;)V",
            &[JValue::Object(&context), JValue::Object(&svc_class.into())],
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

    // intent.putExtra(EXTRA_RULES_JSON, rules_json)
    if let Some(rules) = rules_json {
        let key = env
            .new_string(EXTRA_RULES_JSON)
            .map_err(|e| format!("new_string key: {}", e))?;
        let val = env
            .new_string(rules)
            .map_err(|e| format!("new_string rules: {}", e))?;
        env.call_method(
            &intent,
            "putExtra",
            "(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;",
            &[JValue::Object(&key.into()), JValue::Object(&val.into())],
        )
        .map_err(|e| format!("putExtra: {}", e))?;
    }

    // VPN всегда foreground (Android 8+ убьёт обычный сервис в фоне).
    env.call_method(
        &context,
        "startForegroundService",
        "(Landroid/content/Intent;)Landroid/content/ComponentName;",
        &[JValue::Object(&intent)],
    )
    .map_err(|e| format!("startForegroundService: {}", e))?;

    Ok(())
}

/// Запустить WhispVpnService с пользовательскими правилами (RoutingRule[] как JSON).
/// Сервис сам вызовет VpnService.Builder.establish() и затем дёрнет nativeStart
/// с TUN-fd + этим JSON.
pub fn start_vpn_service(rules_json: &str) -> Result<(), String> {
    send_action(ACTION_START, Some(rules_json))
}

/// Остановить активный WhispVpnService.
pub fn stop_vpn_service() -> Result<(), String> {
    send_action(ACTION_STOP, None)
}
