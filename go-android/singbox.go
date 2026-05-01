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
	"sync"
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

type emptyIterator struct{}

func (e *emptyIterator) Next() *libbox.NetworkInterface { return nil }
func (e *emptyIterator) HasNext() bool                  { return false }

type platform struct{ tunFd int32 }

func (p *platform) OpenTun(options libbox.TunOptions) (int32, error) {
	alog(fmt.Sprintf("OpenTun called, returning fd=%d", p.tunFd))
	return p.tunFd, nil
}
func (p *platform) AutoDetectInterfaceControl(fd int32) error { return nil }
func (p *platform) UsePlatformAutoDetectInterfaceControl() bool { return false }
func (p *platform) UsePlatformDefaultInterfaceMonitor() bool    { return false }
func (p *platform) StartDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) CloseDefaultInterfaceMonitor(l libbox.InterfaceUpdateListener) error {
	return nil
}
func (p *platform) FindConnectionOwner(ipProto int32, srcAddr string, srcPort int32, dstAddr string, dstPort int32) (int32, error) {
	return 0, nil
}
func (p *platform) PackageNameByUid(uid int32) (string, error)  { return "", nil }
func (p *platform) UIDByPackageName(pkg string) (int32, error)  { return 0, nil }
func (p *platform) UsePlatformInterfaceGetter() bool            { return false }
func (p *platform) GetInterfaces() (libbox.NetworkInterfaceIterator, error) {
	return &emptyIterator{}, nil
}
func (p *platform) UnderNetworkExtension() bool                              { return false }
func (p *platform) IncludeAllNetworks() bool                                 { return false }
func (p *platform) WriteLog(message string)                                  { alog("sb: " + message) }
func (p *platform) UseProcFS() bool                                          { return false }
func (p *platform) ReadWIFIState() *libbox.WIFIState                         { return &libbox.WIFIState{} }
func (p *platform) ClearDNSCache()                                           {}
func (p *platform) SendNotification(notification *libbox.Notification) error { return nil }

// Start запускает sing-box. fd — ParcelFileDescriptor.getFd() из Kotlin.
func Start(fd int32, workDir string, socksAddr string) error {
	mu.Lock()
	defer mu.Unlock()

	if service != nil {
		return fmt.Errorf("already running")
	}

	if workDir != "" {
		_ = os.MkdirAll(workDir, 0o755)
		_ = os.Chdir(workDir)
	}

	proxy := ""
	if socksAddr != "" {
		proxy = fmt.Sprintf(`{"type":"socks","tag":"proxy","server":"%s","server_port":1080,"version":"5"}`, "127.0.0.1")
		_ = proxy
	}

	finalOut := "direct"
	if socksAddr != "" {
		finalOut = "proxy"
	}

	outbounds := `[{"type":"direct","tag":"direct"}]`
	if socksAddr != "" {
		outbounds = `[{"type":"direct","tag":"direct"},{"type":"socks","tag":"proxy","server":"127.0.0.1","server_port":1080,"version":"5"}]`
	}

	// Минимальный конфиг без fakeip и сложных DNS-правил
	config := fmt.Sprintf(`{
  "log": {"level": "debug"},
  "dns": {
    "servers": [
      {"tag":"cf","address":"8.8.8.8","detour":"%s"}
    ]
  },
  "inbounds": [{
    "type": "tun",
    "tag": "tun-in",
    "address": ["172.19.0.1/30"],
    "mtu": 1500,
    "auto_route": false,
    "stack": "system"
  }],
  "outbounds": %s,
  "route": {
    "final": "%s",
    "auto_detect_interface": false
  },
  "experimental": {
    "cache_file": {"enabled": false}
  }
}`, finalOut, outbounds, finalOut)

	alog(fmt.Sprintf("NewService fd=%d config=%s", fd, config))
	s, err := libbox.NewService(config, &platform{tunFd: fd})
	if err != nil {
		alog(fmt.Sprintf("NewService error: %v", err))
		return fmt.Errorf("NewService: %w", err)
	}
	alog("NewService OK")

	if err := s.Start(); err != nil {
		alog(fmt.Sprintf("Start error: %v", err))
		_ = s.Close()
		return fmt.Errorf("Start: %w", err)
	}
	alog("Start OK — running")
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
