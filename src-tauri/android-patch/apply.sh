#!/usr/bin/env bash
# Применяет android-patch к gen/android/, который Tauri регенерирует на каждом
# `tauri android init`. Запускается в CI после init и до build.
#
# Что делает:
#   1. Копирует Kotlin-файлы в нужный пакет.
#   2. Инжектит permissions + service в AndroidManifest.xml.
#   3. (TODO) Подключает libwhisp_vpn_android.so в jniLibs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/gen/android"
PKG_DIR="$GEN/app/src/main/java/com/whispera/whisp"
MANIFEST="$GEN/app/src/main/AndroidManifest.xml"

if [ ! -d "$GEN" ]; then
  echo "[android-patch] gen/android not found — run 'tauri android init' first" >&2
  exit 1
fi

echo "[android-patch] copying Kotlin files → $PKG_DIR"
mkdir -p "$PKG_DIR"
cp "$ROOT/android-patch/java/com/whispera/whisp/"*.kt "$PKG_DIR/"

echo "[android-patch] patching AndroidManifest.xml"
ADDITIONS="$ROOT/android-patch/manifest/manifest-additions.xml"

PERMS=$(awk '/^PERMISSIONS:/{flag=1; next} /^SERVICE:/{flag=0} flag' "$ADDITIONS")
SERVICE=$(awk '/^SERVICE:/{flag=1; next} flag' "$ADDITIONS")

# Перешиваем только если ещё не пропатчено.
if grep -q "WhispVpnService" "$MANIFEST"; then
  echo "[android-patch] manifest already patched, skipping"
else
  # Permissions — после открывающего <manifest ...>.
  python3 - <<PY
import re, pathlib
p = pathlib.Path("$MANIFEST")
src = p.read_text(encoding="utf-8")
perms = """$PERMS"""
service = """$SERVICE"""
src = re.sub(r"(<manifest[^>]*>)", r"\1\n" + perms, src, count=1)
src = re.sub(r"(</application>)", service + r"\n    \1", src, count=1)
p.write_text(src, encoding="utf-8")
print("[android-patch] manifest patched")
PY
fi

echo "[android-patch] done"
