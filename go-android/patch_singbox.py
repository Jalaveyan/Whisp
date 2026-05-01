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

def zero_return(sig):
    """Return a valid Go 'return ...' for zero values inferred from method signature."""
    # Extract the return part: everything after the last ')' before '{'
    m = re.search(r'\)\s*(.*?)\s*\{', sig, re.DOTALL)
    if not m:
        return 'return'
    ret = m.group(1).strip().rstrip('{').strip()
    if not ret:
        return 'return'
    if ret == 'error':
        return 'return nil'
    if ret == 'string':
        return 'return ""'
    if ret == 'bool':
        return 'return false'
    if re.match(r'^u?int\d*$', ret) or ret in ('byte', 'rune'):
        return 'return 0'
    if ret.startswith('('):
        # Multiple return values: (Type1, Type2, ...)
        inner = ret.strip('()').strip()
        # Split by comma, but ignore commas inside brackets
        parts = re.split(r',(?![^[]*])', inner)
        zeros = []
        for part in parts:
            t = part.strip().split()[-1] if part.strip() else ''
            if t == 'error' or t.startswith('*') or t.startswith('[') or t.startswith('map') or t.startswith('chan'):
                zeros.append('nil')
            elif t == 'string':
                zeros.append('""')
            elif t == 'bool':
                zeros.append('false')
            elif re.match(r'^u?int\d*$', t) or t in ('byte', 'rune'):
                zeros.append('0')
            else:
                zeros.append('nil')
        return 'return ' + ', '.join(zeros)
    # Pointer, interface, or other reference type
    return 'return nil'

# ── Pass 1: chown ──────────────────────────────────────────────────────────
for p in root.rglob("*.go"):
    patch_file(p,
        (r'return\s+\w+\.Cause\(err,\s*"platform chown"\)',
         'return nil // Android: chown not permitted'),
        (r'(?:if\s+)?err\s*(?::)?=\s*os\.Chown\([^)]+\)\s*;\s*err\s*!=\s*nil\s*\{',
         'if false { // chown skipped on Android'),
    )

# ── Pass 2: cachefile — nil-safe all methods ───────────────────────────────
#
# bbolt mmap fails in gomobile on Android. Make New() return nil so no bbolt
# is ever opened. sing-box calls CacheFile methods without nil-checking the
# receiver, so we add early-return guards to EVERY method in the package.
for p in root.rglob("*.go"):
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if 'package cachefile' not in c:
        continue

    changed = False

    # 2a. New() → nil (only the variant returning *CacheFile, not (*CacheFile,error))
    n = re.sub(
        r'(func New\s*\([^)]*\)\s*\*CacheFile\s*\{)',
        r'\1\n\treturn nil // Android: bbolt disabled',
        c,
        count=1,
    )
    if n != c:
        c = n; changed = True
        print(f"[patch] New()→nil  {p.relative_to(root)}")

    # 2b. nil guard on every (c *CacheFile) method in this file
    def add_guard(m):
        sig = m.group(0)
        guard = zero_return(sig)
        return sig + f'\n\tif c == nil {{ {guard} }}'

    n = re.sub(
        r'func \(c \*CacheFile\) \w+\([^)]*\)[^{]*\{',
        add_guard,
        c,
    )
    if n != c:
        c = n; changed = True
        print(f"[patch] nil guards  {p.relative_to(root)}")

    if changed:
        p.write_text(c, encoding="utf-8")
        if str(p.relative_to(root)) not in patched:
            patched.append(str(p.relative_to(root)))

if patched:
    print("Patched files:", *patched, sep="\n  ")
else:
    print("WARNING: no files were patched — check sing-box source layout")
    sys.exit(1)
