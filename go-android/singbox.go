// Package singbox exposes sing-box engine to Android via gomobile.
// TUN fd передаётся через PlatformInterface.OpenTun() — единственный
// поддерживаемый способ в sing-box v1.10.x (не через JSON/option struct).
package singbox

// #cgo LDFLAGS: -llog
// #include <android/log.h>
// #include <stdlib.h>
// static void go_logcat(const char* msg) {
//     __android_log_print(ANDROID_LOG_INFO, "singbox-go", "%s", msg);
// }
import "C"

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"time"
	"unsafe"

	"github.com/sagernet/sing-box/experimental/libbox"
)

func alog(msg string) {
	cs := C.CString(msg)
	C.go_logcat(cs)
	C.free(unsafe.Pointer(cs))
}

var (
	mu      sync.Mutex
	service *libbox.BoxService
)

// emptyIterator реализует libbox.NetworkInterfaceIterator — пустой список.
type emptyIterator struct{}

func (e *emptyIterator) Next() *libbox.NetworkInterface { return nil }
func (e *emptyIterator) HasNext() bool                  { return false }

// platform реализует libbox.PlatformInterface.
type platform struct{ tunFd int32 }

func (p *platform) OpenTun(options libbox.TunOptions) (int32, error) {
	return p.tunFd, nil
}
func (p *platform) AutoDetectInterfaceControl(fd int32) error          { return nil }
func (p *platform) UsePlatformAutoDetectInterfaceControl() bool        { return true }
func (p *platform) UsePlatformDefaultInterfaceMonitor() bool           { return true }
func (p *platform) StartDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) CloseDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) FindConnectionOwner(ipProto int32, srcAddr string, srcPort int32, dstAddr string, dstPort int32) (int32, error) {
	return 0, nil
}
func (p *platform) PackageNameByUid(uid int32) (string, error) { return "", nil }
func (p *platform) UIDByPackageName(pkg string) (int32, error) { return 0, nil }
func (p *platform) UsePlatformInterfaceGetter() bool           { return true }
func (p *platform) GetInterfaces() (libbox.NetworkInterfaceIterator, error) {
	return &emptyIterator{}, nil
}
func (p *platform) UnderNetworkExtension() bool                             { return false }
func (p *platform) IncludeAllNetworks() bool                                { return false }
func (p *platform) WriteLog(message string)                                 { alog("sb: " + message) }
func (p *platform) UseProcFS() bool                                         { return false }
func (p *platform) ReadWIFIState() *libbox.WIFIState                        { return &libbox.WIFIState{} }
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

	// watchdog: если через 10 сек не вышли — дампим goroutine stack в logcat
	done := make(chan struct{})
	go func() {
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			buf := make([]byte, 64*1024)
			n := runtime.Stack(buf, true)
			alog(fmt.Sprintf("WATCHDOG: Start() hung >10s\n%s", string(buf[:n])))
		}
	}()
	defer close(done)

	alog(fmt.Sprintf("calling libbox.NewService fd=%d", fd))
	s, err := libbox.NewService(configJSON, &platform{tunFd: int32(fd)})
	if err != nil {
		alog(fmt.Sprintf("NewService error: %v", err))
		return fmt.Errorf("libbox.NewService: %w", err)
	}
	alog("NewService OK, calling s.Start()")
	if err := s.Start(); err != nil {
		alog(fmt.Sprintf("s.Start() error: %v", err))
		_ = s.Close()
		return fmt.Errorf("boxService.Start: %w", err)
	}
	alog("s.Start() OK — VPN running")
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
