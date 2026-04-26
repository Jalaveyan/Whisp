#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="$ROOT/gen/android"
PKG_DIR="$GEN/app/src/main/java/com/whispera/whisp"
MANIFEST="$GEN/app/src/main/AndroidManifest.xml"
WRYACT="$GEN/app/src/main/java/com/whispera/whisp/generated/WryActivity.kt"

if [ ! -d "$GEN" ]; then
  echo "[android-patch] gen/android not found" >&2
  exit 1
fi

echo "[android-patch] copying Kotlin files → $PKG_DIR"
mkdir -p "$PKG_DIR"
cp "$ROOT/android-patch/java/com/whispera/whisp/"*.kt "$PKG_DIR/"

# Tauri 2 codegen на некоторых конфигурациях кладёт `import android.content.Intent`
# внутрь `companion object` в WryActivity.kt — невалидный Kotlin. Вырезаем строку.
if [ -f "$WRYACT" ]; then
  python3 - <<PY
import pathlib, re
p = pathlib.Path("$WRYACT")
src = p.read_text(encoding="utf-8")
new = re.sub(r"\n\s*import\s+android\.content\.Intent\s*\n", "\n", src)
if new != src:
    p.write_text(new, encoding="utf-8")
    print("[android-patch] WryActivity.kt: removed misplaced import")
PY
fi

if grep -q "WhispVpnService" "$MANIFEST"; then
  echo "[android-patch] manifest already patched"
else
  ADDITIONS="$ROOT/android-patch/manifest/manifest-additions.xml"
  PERMS=$(awk '/^PERMISSIONS:/{flag=1; next} /^SERVICE:/{flag=0} flag' "$ADDITIONS")
  SERVICE=$(awk '/^SERVICE:/{flag=1; next} flag' "$ADDITIONS")
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
