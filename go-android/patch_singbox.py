"""Patch sing-box source: make 'platform chown' a no-op on Android."""
import pathlib, re, sys

root = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("./sing-box-patched")

patched = []
for p in root.rglob("*.go"):
    try:
        c = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    n = re.sub(
        r'return\s+\w+\.Cause\(err,\s*"platform chown"\)',
        'return nil // Android: chown not permitted, ignored',
        c,
    )
    n = re.sub(
        r'(?:if\s+)?err\s*(?::)?=\s*os\.Chown\([^)]+\)\s*;\s*err\s*!=\s*nil\s*\{',
        'if false { // chown skipped on Android',
        n,
    )
    if n != c:
        p.write_text(n, encoding="utf-8")
        patched.append(str(p.relative_to(root)))

if patched:
    print("Patched files:")
    for f in patched:
        print(" ", f)
else:
    print("WARNING: 'platform chown' pattern not found — Chown occurrences:")
    for p in root.rglob("*.go"):
        try:
            c = p.read_text(errors="replace")
        except Exception:
            continue
        if "Chown" in c or "chown" in c:
            for i, line in enumerate(c.splitlines(), 1):
                if "Chown" in line or "chown" in line:
                    print(f"  {p.relative_to(root)}:{i}: {line.strip()}")
    sys.exit(1)
