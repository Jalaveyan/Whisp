"""Patch sing-box source for Android/gomobile compatibility."""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("./sing-box-patched")

patched = []

def patch_file(p, *subs):
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

    # 2. cachefile package: bbolt mmap fails in gomobile on Android.
    #
    #    Strategy: make New() return nil so the CacheFile is nil.
    #    sing-box calls lifecycle methods (PreStart/Start/Close) and accessor
    #    methods (LoadMode/StoreMode) directly on the CacheFile WITHOUT nil-
    #    checking the receiver. We add early-return nil guards to every method
    #    so nil-receiver calls become no-ops.
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if 'package cachefile' not in c:
        continue

    changed = False

    # 2a. Make New() always return nil (no CacheFile, no bbolt)
    n = re.sub(
        r'(func New\s*\([^)]*\)\s*\*CacheFile\s*\{)',
        r'\1\n\treturn nil // Android: bbolt disabled',
        c,
        count=1,
    )
    if n != c:
        c = n
        changed = True
        print(f"[patch] New()→nil in {p.relative_to(root)}")

    # 2b. Nil guards for error-returning lifecycle/helper methods
    for method in ('start', 'PreStart', 'Start', 'PostStart', 'Close', 'PostClose',
                   'StoreMode', 'SaveMode'):
        n = re.sub(
            r'(func \(c \*CacheFile\) ' + method + r'\b[^{]*\{)',
            r'\1\n\tif c == nil { return nil }',
            c,
        )
        if n != c:
            c = n
            changed = True
            print(f"[patch] {method}: nil guard in {p.relative_to(root)}")

    # 2c. LoadMode returns string, not error
    n = re.sub(
        r'(func \(c \*CacheFile\) LoadMode\b[^{]*\{)',
        r'\1\n\tif c == nil { return "" }',
        c,
    )
    if n != c:
        c = n
        changed = True
        print(f"[patch] LoadMode: nil guard in {p.relative_to(root)}")

    if changed:
        p.write_text(c, encoding="utf-8")
        if str(p.relative_to(root)) not in patched:
            patched.append(str(p.relative_to(root)))

if patched:
    print("Patched files:")
    for f in patched:
        print(" ", f)
else:
    print("WARNING: no files were patched — check sing-box source layout")
    sys.exit(1)
