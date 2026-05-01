// Package singbox exposes sing-box engine to Android via gomobile.
// TUN fd передаётся через PlatformInterface.OpenTun() — единственный
// поддерживаемый способ в sing-box v1.10.x (не через JSON/option struct).
package singbox

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/sagernet/sing-box/experimental/libbox"
)

var (
	mu      sync.Mutex
	service *libbox.BoxService
)

// platform реализует libbox.PlatformInterface.
type platform struct{ tunFd int32 }

func (p *platform) OpenTun(options libbox.TunOptions) (int32, error) {
	return p.tunFd, nil
}
func (p *platform) AutoDetectInterfaceControl(fd int32) error { return nil }
// Возвращаем true — sing-box будет звать наши no-op методы вместо
// создания системных сокетов/мониторов, которые блокируются на Android.
func (p *platform) UsePlatformAutoDetectInterfaceControl() bool { return true }
func (p *platform) UsePlatformDefaultInterfaceMonitor() bool    { return true }
func (p *platform) StartDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) CloseDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) FindConnectionOwner(ipProto int32, srcAddr string, srcPort int32, dstAddr string, dstPort int32) (int32, error) {
	return 0, nil
}
func (p *platform) PackageNameByUid(uid int32) (string, error)              { return "", nil }
func (p *platform) UIDByPackageName(pkg string) (int32, error)              { return 0, nil }
func (p *platform) UsePlatformInterfaceGetter() bool                        { return true }
func (p *platform) GetInterfaces() (libbox.NetworkInterfaceIterator, error) { return nil, nil }
func (p *platform) UnderNetworkExtension() bool                             { return false }
func (p *platform) IncludeAllNetworks() bool                                { return false }
func (p *platform) WriteLog(message string)                                 {}
func (p *platform) UseProcFS() bool                                         { return false }
func (p *platform) ReadWIFIState() *libbox.WIFIState                        { return nil }
func (p *platform) ClearDNSCache()                                          {}
func (p *platform) SendNotification(notification *libbox.Notification) error { return nil }

// Start запускает sing-box. fd — ParcelFileDescriptor.getFd() из Kotlin.
// workDir — filesDir приложения (writable); sing-box создаёт там cache.db.
// configJSON — стандартный sing-box JSON без поля fd в tun inbound.
func Start(fd int, workDir string, configJSON string) error {
	mu.Lock()
	defer mu.Unlock()

	if service != nil {
		return fmt.Errorf("already running")
	}

	if workDir != "" {
		_ = os.MkdirAll(workDir, 0o755)
		_ = os.Chdir(workDir)
	}

	// watchdog: если через 15 сек не вышли — дампим goroutine stack в logcat
	done := make(chan struct{})
	go func() {
		select {
		case <-done:
		case <-time.After(15 * time.Second):
			buf := make([]byte, 64*1024)
			n := runtime.Stack(buf, true)
			log.Printf("[singbox] WATCHDOG: Start() hung >15s, goroutines:\n%s", buf[:n])
		}
	}()
	defer close(done)

	log.Printf("[singbox] calling libbox.NewService fd=%d", fd)
	s, err := libbox.NewService(configJSON, &platform{tunFd: int32(fd)})
	if err != nil {
		log.Printf("[singbox] NewService error: %v", err)
		return fmt.Errorf("libbox.NewService: %w", err)
	}
	log.Printf("[singbox] NewService OK, calling s.Start()")
	if err := s.Start(); err != nil {
		log.Printf("[singbox] s.Start() error: %v", err)
		_ = s.Close()
		return fmt.Errorf("boxService.Start: %w", err)
	}
	log.Printf("[singbox] s.Start() OK — VPN running")
	service = s
	return nil
}

// Stop останавливает sing-box.
func Stop() {
	mu.Lock()
	defer mu.Unlock()

	if service != nil {
		_ = service.Close()
		service = nil
	}
}
