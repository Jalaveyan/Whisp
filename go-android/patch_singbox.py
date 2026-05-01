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

def type_zero(t):
    """Return the Go zero-value literal for type string t."""
    t = t.strip()
    # named return: "name type" → take the type (last word)
    parts = t.split()
    if len(parts) > 1:
        t = parts[-1]
    if not t:
        return 'nil'
    if t in ('error',) or t.startswith('*') or t.startswith('[') \
            or t.startswith('map') or t.startswith('chan') \
            or t in ('interface{}', 'any'):
        return 'nil'
    if t == 'string':
        return '""'
    if t == 'bool':
        return 'false'
    if re.match(r'^u?int\d*$', t) or t in ('byte', 'rune', 'float32', 'float64', 'uintptr'):
        return '0'
    # Qualified struct type (e.g. netip.Addr, netipx.IPSet)
    if re.match(r'^[A-Za-z]\w*\.[A-Za-z]\w*$', t):
        return t + '{}'
    return 'nil'

def zero_return(sig):
    """
    Given a matched *CacheFile method signature line
      func (c *CacheFile) Name(params) ReturnType {
    return the appropriate Go early-return statement.
    """
    # Extract return type: everything between closing-param-paren and opening brace.
    # We match the SECOND pair of parens (params), not the receiver pair.
    m = re.match(
        r'func \(c \*CacheFile\) \w+\([^)]*\)\s*(.*?)\s*\{',
        sig, re.DOTALL
    )
    if not m:
        return 'return'
    ret = m.group(1).strip()

    if not ret:
        return 'return'          # void

    # Single return type
    if not ret.startswith('('):
        return 'return ' + type_zero(ret)

    # Multiple return types: (T1, T2, ...)
    inner = ret.strip('()').strip()
    # Split by comma not inside brackets
    parts = re.split(r',\s*', inner)
    return 'return ' + ', '.join(type_zero(p) for p in parts)

# ── Pass 1: chown ──────────────────────────────────────────────────────────
for p in root.rglob("*.go"):
    patch_file(p,
        (r'return\s+\w+\.Cause\(err,\s*"platform chown"\)',
         'return nil // Android: chown not permitted'),
        (r'(?:if\s+)?err\s*(?::)?=\s*os\.Chown\([^)]+\)\s*;\s*err\s*!=\s*nil\s*\{',
         'if false { // chown skipped on Android'),
    )

# ── Pass 2: cachefile — nil-safe all *CacheFile methods ───────────────────
for p in root.rglob("*.go"):
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if 'package cachefile' not in c:
        continue

    changed = False

    # 2a. New() → nil  (variant returning *CacheFile only, no error)
    n = re.sub(
        r'(func New\s*\([^)]*\)\s*\*CacheFile\s*\{)',
        r'\1\n\treturn nil // Android: bbolt disabled',
        c, count=1,
    )
    if n != c:
        c = n; changed = True
        print(f"[patch] New()→nil  {p.relative_to(root)}")

    # 2b. Nil guard on every (c *CacheFile) method in this file.
    #     We insert `if c == nil { <zero-return> }` right after the opening brace.
    def add_guard(m):
        sig = m.group(0)
        early = zero_return(sig)
        return sig + f'\n\tif c == nil {{ {early} }}'

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
    print("Patched:", *patched, sep="\n  ")
else:
    print("WARNING: no files patched")
    sys.exit(1)
