package desktop

import (
	"os/exec"

	"lightstudio/internal/app"
	"lightstudio/internal/lighting"
)

// Keyboard 只暴露界面接口，控制器的启动和退出方法不进入前端绑定。
type Keyboard struct {
	controller *app.Controller
}

func NewKeyboard(controller *app.Controller) *Keyboard {
	return &Keyboard{controller: controller}
}

func (k *Keyboard) Snapshot() (app.Snapshot, error) {
	return k.controller.Snapshot()
}
func (k *Keyboard) Apply(settings lighting.Settings) (app.Snapshot, error) {
	return k.controller.Apply(settings)
}
func (k *Keyboard) Release() (app.Snapshot, error) {
	return k.controller.Release()
}
func (k *Keyboard) SavePreset(name string, settings lighting.Settings) (app.Snapshot, error) {
	return k.controller.SavePreset(name, settings)
}
func (k *Keyboard) DeletePreset(id string) (app.Snapshot, error) {
	return k.controller.DeletePreset(id)
}
func (k *Keyboard) OpenPermissions() error {
	return exec.Command("/usr/bin/open", "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent").Run()
}
