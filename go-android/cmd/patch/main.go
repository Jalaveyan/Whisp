// Patches sing-box source tree for Android compatibility.
// Usage: go run ./cmd/patch <path-to-sing-box-source>
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type patch struct {
	file string
	old  string
	new  string
}

var patches = []patch{
	{
		// filemanager.Chown fails on Android with EPERM — make it non-fatal.
		// cachefile still opens and works; only ownership metadata is skipped.
		file: "experimental/cachefile/cache.go",
		old: `	err = filemanager.Chown(c.ctx, c.path)
	if err != nil {
		db.Close()
		return E.Cause(err, "platform chown")
	}`,
		new: `	_ = filemanager.Chown(c.ctx, c.path) // Android: EPERM is non-fatal`,
	},
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: patch <sing-box-dir>")
		os.Exit(1)
	}
	root := os.Args[1]
	for _, p := range patches {
		path := filepath.Join(root, filepath.FromSlash(p.file))
		b, err := os.ReadFile(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "read %s: %v\n", path, err)
			os.Exit(1)
		}
		s := string(b)
		if !strings.Contains(s, p.old) {
			fmt.Fprintf(os.Stderr, "patch target not found in %s — version mismatch?\n", p.file)
			os.Exit(1)
		}
		s = strings.Replace(s, p.old, p.new, 1)
		if err := os.WriteFile(path, []byte(s), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "write %s: %v\n", path, err)
			os.Exit(1)
		}
		fmt.Printf("patched: %s\n", p.file)
	}
}
