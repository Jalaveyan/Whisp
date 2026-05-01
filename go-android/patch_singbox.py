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

    # 2. cachefile: bbolt always fails in gomobile/Android — patch at source.
    #    New() returns *CacheFile (no error); db is set later in Start().
    #    Patch New() → nil so callers' nil-guards skip all bbolt usage.
    #    Also guard LoadMode/SaveMode against nil db as defence-in-depth.
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if 'package cachefile' not in c:
        continue
    changed = False
    # 2a. func New(...) *CacheFile { → return nil immediately
    n = re.sub(
        r'(func New\s*\([^)]*\)\s*\*CacheFile\s*\{)',
        r'\1\n\treturn nil // Android: bbolt disabled in gomobile',
        c,
        count=1,
    )
    if n != c:
        changed = True
        c = n
        print(f"[patch] cachefile.New() → nil in {p.relative_to(root)}")
    # 2b. guard any method that calls c.db.* — insert early nil-db return
    for method in ('LoadMode', 'SaveMode', 'StoreMode'):
        n = re.sub(
            r'(func \(c \*CacheFile\) ' + method + r'\b[^{]*\{)',
            r'\1\n\tif c == nil || c.db == nil { return }\n',
            c,
        )
        if n != c:
            changed = True
            c = n
            print(f"[patch] {method} nil-db guard in {p.relative_to(root)}")
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
