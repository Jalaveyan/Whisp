//! Список установленных пользовательских приложений через PackageManager.
//!
//! Используется UI Whisp (страница Маршруты → "Приложение") чтобы показать
//! пикер из реально установленных пакетов вместо file-input как на desktop.
//!
//! Возвращаем (package_name, label) — package для mihomo PROCESS-NAME,
//! label для отображения юзеру.

use jni::objects::{JObject, JValue};
use jni::JavaVM;

const FLAG_SYSTEM: i32 = 1; // ApplicationInfo.FLAG_SYSTEM
const FLAG_UPDATED_SYSTEM_APP: i32 = 0x00000080;

#[derive(Debug, Clone)]
pub struct InstalledApp {
    pub package: String,
    pub label: String,
}

pub fn list_user_packages() -> Result<Vec<InstalledApp>, String> {
    let ctx = ndk_context::android_context();
    if ctx.vm().is_null() || ctx.context().is_null() {
        return Err("ndk_context not initialized".to_string());
    }
    let vm = unsafe { JavaVM::from_raw(ctx.vm() as *mut _) }
        .map_err(|e| format!("JavaVM::from_raw: {}", e))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|e| format!("attach_current_thread: {}", e))?;
    let context = unsafe { JObject::from_raw(ctx.context() as jni::sys::jobject) };

    // PackageManager pm = context.getPackageManager();
    let pm = env
        .call_method(
            &context,
            "getPackageManager",
            "()Landroid/content/pm/PackageManager;",
            &[],
        )
        .and_then(|v| v.l())
        .map_err(|e| format!("getPackageManager: {}", e))?;

    // List<ApplicationInfo> apps = pm.getInstalledApplications(0);
    let apps_list = env
        .call_method(
            &pm,
            "getInstalledApplications",
            "(I)Ljava/util/List;",
            &[JValue::Int(0)],
        )
        .and_then(|v| v.l())
        .map_err(|e| format!("getInstalledApplications: {}", e))?;

    let size = env
        .call_method(&apps_list, "size", "()I", &[])
        .and_then(|v| v.i())
        .map_err(|e| format!("List.size: {}", e))?;

    let mut out = Vec::with_capacity(size as usize);
    for i in 0..size {
        let app_info = env
            .call_method(&apps_list, "get", "(I)Ljava/lang/Object;", &[JValue::Int(i)])
            .and_then(|v| v.l())
            .map_err(|e| format!("List.get({}): {}", i, e))?;

        // ApplicationInfo.flags — отфильтровать system apps.
        let flags = env
            .get_field(&app_info, "flags", "I")
            .and_then(|v| v.i())
            .unwrap_or(0);
        if (flags & FLAG_SYSTEM) != 0 && (flags & FLAG_UPDATED_SYSTEM_APP) == 0 {
            continue; // pure system app — пропускаем
        }

        // ApplicationInfo.packageName — public field
        let pkg_obj = env
            .get_field(&app_info, "packageName", "Ljava/lang/String;")
            .and_then(|v| v.l())
            .map_err(|e| format!("packageName: {}", e))?;
        let pkg: String = env
            .get_string(&pkg_obj.into())
            .map_err(|e| format!("packageName get_string: {}", e))?
            .into();

        // CharSequence label = pm.getApplicationLabel(appInfo);
        let label_obj = env
            .call_method(
                &pm,
                "getApplicationLabel",
                "(Landroid/content/pm/ApplicationInfo;)Ljava/lang/CharSequence;",
                &[JValue::Object(&app_info)],
            )
            .and_then(|v| v.l())
            .map_err(|e| format!("getApplicationLabel: {}", e))?;
        // label.toString()
        let label_str = env
            .call_method(&label_obj, "toString", "()Ljava/lang/String;", &[])
            .and_then(|v| v.l())
            .map_err(|e| format!("toString: {}", e))?;
        let label: String = env
            .get_string(&label_str.into())
            .map_err(|e| format!("label get_string: {}", e))?
            .into();

        out.push(InstalledApp { package: pkg, label });
    }

    out.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(out)
}
