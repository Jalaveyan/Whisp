// Package singbox exposes sing-box engine to Android via gomobile.
// gomobile bind → singbox.aar → Kotlin: SingBox.start(fd, configJson)
package singbox

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	box "github.com/sagernet/sing-box"
	"github.com/sagernet/sing-box/option"
)

var (
	mu       sync.Mutex
	instance *box.Box
	cancel   context.CancelFunc
)

// Start запускает sing-box с переданным TUN fd и JSON конфигом.
// fd — значение из ParcelFileDescriptor.getFd().
// configJSON — стандартный sing-box JSON без поля fd в inbound (мы ставим его сами).
func Start(fd int, configJSON string) error {
	mu.Lock()
	defer mu.Unlock()

	if instance != nil {
		return fmt.Errorf("already running")
	}

	var opts option.Options
	if err := json.Unmarshal([]byte(configJSON), &opts); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	// Устанавливаем fd напрямую через Go API — в JSON это поле недоступно.
	for i := range opts.Inbounds {
		if opts.Inbounds[i].Type == "tun" {
			tun := opts.Inbounds[i].TunOptions
			tun.FileDescriptor = fd
			opts.Inbounds[i].TunOptions = tun
		}
	}

	ctx, c := context.WithCancel(context.Background())
	b, err := box.New(box.Options{
		Context: ctx,
		Options: opts,
	})
	if err != nil {
		c()
		return fmt.Errorf("box.New: %w", err)
	}

	if err := b.Start(); err != nil {
		c()
		return fmt.Errorf("box.Start: %w", err)
	}

	instance = b
	cancel = c
	return nil
}

// Stop останавливает sing-box.
func Stop() {
	mu.Lock()
	defer mu.Unlock()

	if cancel != nil {
		cancel()
		cancel = nil
	}
	if instance != nil {
		_ = instance.Close()
		instance = nil
	}
}
