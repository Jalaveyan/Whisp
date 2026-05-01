"""Patch sing-box source for Android/gomobile compatibility."""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("./sing-box-patched")

patched = []

def patch_file(p, *subs):
    """Apply (pattern, repl) pairs to file, return True if changed."""
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return False
    n = c
    for pattern, repl in subs:
        n = re.sub(pattern, repl, n)
    if n != c:
        p.write_text(n, encoding="utf-8")
        patched.append(str(p.relative_to(root)))
        return True
    return False

for p in root.rglob("*.go"):
    # 1. chown: not permitted in Android VPN sandbox
    patch_file(p,
        (r'return\s+\w+\.Cause\(err,\s*"platform chown"\)',
         'return nil // Android: chown not permitted'),
        (r'(?:if\s+)?err\s*(?::)?=\s*os\.Chown\([^)]+\)\s*;\s*err\s*!=\s*nil\s*\{',
         'if false { // chown skipped on Android'),
    )

    # 2. cachefile.New: bbolt mmap fails on Android → always return nil (no cache)
    #    sing-box is nil-safe for CacheFile when NeedCacheFile() is false.
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if 'package cachefile' in c and re.search(r'func New\b', c):
        n = re.sub(
            r'(func New\s*\([^)]*\)[^{]*\{)',
            r'\1\n\treturn nil, nil // Android: bbolt mmap not supported in gomobile',
            c,
            count=1,
        )
        if n != c:
            p.write_text(n, encoding="utf-8")
            if str(p.relative_to(root)) not in patched:
                patched.append(str(p.relative_to(root)))
            print(f"[patch] disabled cachefile.New() in {p.relative_to(root)}")

if patched:
    print("Patched files:")
    for f in patched:
        print(" ", f)
else:
    print("WARNING: no files were patched — check sing-box source layout")
    sys.exit(1)
