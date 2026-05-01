package tun2socks

import (
	"fmt"
	"sync"

	"github.com/xjasonlyu/tun2socks/v2/engine"
)

var (
	mu      sync.Mutex
	running bool
)

// Start запускает tun2socks: fd — ParcelFileDescriptor.getFd() из Kotlin,
// proxy — адрес SOCKS5/HTTP прокси, напр. "socks5://127.0.0.1:1080".
func Start(fd int32, proxy string) error {
	mu.Lock()
	defer mu.Unlock()
	if running {
		return fmt.Errorf("already running")
	}
	engine.Insert(&engine.Key{
		MTU:      1500,
		Device:   fmt.Sprintf("fd://%d", fd),
		Proxy:    proxy,
		LogLevel: "info",
	})
	if err := engine.Start(); err != nil {
		return fmt.Errorf("engine.Start: %w", err)
	}
	running = true
	return nil
}

// Stop останавливает tun2socks.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if running {
		_ = engine.Stop()
		running = false
	}
}
