module whisp/tun2socks

go 1.22

require (
	github.com/xjasonlyu/tun2socks/v2 v2.5.2
	golang.org/x/mobile v0.0.0-20240213143359-d1f7d3436075
)

// sagernet/gvisor removes //go:linkname runtime internals — required for gomobile c-shared
replace gvisor.dev/gvisor => github.com/sagernet/gvisor v0.0.0-20241123041152-536d05261cff
