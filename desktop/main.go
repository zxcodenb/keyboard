package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"github.com/egoist/mygo"
)

type Settings struct {
	Mode       string            `json:"mode"`
	Color      string            `json:"color"`
	Secondary  string            `json:"secondary"`
	Brightness int               `json:"brightness"`
	Speed      int               `json:"speed"`
	Power      bool              `json:"power"`
	Overrides  map[string]string `json:"overrides"`
}

type Preset struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Settings Settings `json:"settings"`
}

type Snapshot struct {
	Settings   Settings `json:"settings"`
	Controlled bool     `json:"controlled"`
	Connected  bool     `json:"connected"`
	Sending    bool     `json:"sending"`
	Message    string   `json:"message"`
	Presets    []Preset `json:"presets"`
}

type Keyboard struct {
	mu     sync.Mutex
	cmd    *exec.Cmd
	input  io.WriteCloser
	output *bufio.Scanner
}

func (k *Keyboard) start() error {
	resources, err := mygo.App.Path(mygo.PathResources)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(filepath.Join(resources, "local.json"))
	if err != nil {
		return fmt.Errorf("缺少本机环境配置，请在 desktop 目录运行 npm run build：%w", err)
	}
	var local struct{ Python string }
	if err := json.Unmarshal(data, &local); err != nil {
		return err
	}
	stateDir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return err
	}
	cmd := exec.Command(local.Python, "-u", filepath.Join(resources, "bridge.py"), filepath.Join(stateDir, "lighting.json"))
	cmd.Env = append(os.Environ(), "PYTHONDONTWRITEBYTECODE=1")
	cmd.Stderr = os.Stderr
	input, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	output, err := cmd.StdoutPipe()
	if err != nil {
		input.Close()
		return err
	}
	if err = cmd.Start(); err != nil {
		input.Close()
		output.Close()
		return fmt.Errorf("无法启动本地控制脚本，请检查项目的 .venv：%w", err)
	}
	k.cmd, k.input, k.output = cmd, input, bufio.NewScanner(output)
	k.output.Buffer(make([]byte, 4096), 4*1024*1024)
	return nil
}

func (k *Keyboard) request(request map[string]any) (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.cmd == nil {
		if err := k.start(); err != nil {
			return Snapshot{}, err
		}
	}
	if err := json.NewEncoder(k.input).Encode(request); err != nil {
		k.stop()
		return Snapshot{}, fmt.Errorf("控制进程已断开，请重试：%w", err)
	}
	if !k.output.Scan() {
		k.stop()
		return Snapshot{}, fmt.Errorf("控制脚本已退出，请检查 .venv 中的 hidapi 依赖")
	}
	var reply struct {
		Data  Snapshot `json:"data"`
		Error string   `json:"error"`
	}
	if err := json.Unmarshal(k.output.Bytes(), &reply); err != nil {
		return Snapshot{}, err
	}
	if reply.Error != "" {
		return Snapshot{}, fmt.Errorf("%s", reply.Error)
	}
	return reply.Data, nil
}

func (k *Keyboard) Snapshot() (Snapshot, error) {
	return k.request(map[string]any{"action": "snapshot"})
}
func (k *Keyboard) Apply(settings Settings) (Snapshot, error) {
	return k.request(map[string]any{"action": "apply", "settings": settings})
}
func (k *Keyboard) Release() (Snapshot, error) {
	return k.request(map[string]any{"action": "release"})
}
func (k *Keyboard) SavePreset(name string, settings Settings) (Snapshot, error) {
	return k.request(map[string]any{"action": "savePreset", "name": name, "settings": settings})
}
func (k *Keyboard) DeletePreset(id string) (Snapshot, error) {
	return k.request(map[string]any{"action": "deletePreset", "id": id})
}

func (k *Keyboard) OpenPermissions() error {
	return exec.Command("/usr/bin/open", "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent").Run()
}

func (k *Keyboard) stop() {
	if k.cmd != nil {
		k.input.Close()
		k.cmd.Wait()
		k.cmd = nil
	}
}

func main() {
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	keyboard := &Keyboard{}
	defer func() {
		keyboard.mu.Lock()
		defer keyboard.mu.Unlock()
		keyboard.stop()
	}()
	mygo.Bind(keyboard)
	var window *mygo.Window
	quitting := false
	show := func() {
		if window != nil {
			window.Show()
			if window.IsMinimized() {
				window.Restore()
			}
			window.Focus()
		}
	}
	mygo.App.OnBeforeQuit(func(e *mygo.QuitEvent) { quitting = true })
	mygo.App.OnActivate(func(visible bool) {
		if !visible {
			show()
		}
	})
	mygo.App.OnSecondInstance(func(args []string, dir string) { show() })
	mygo.App.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
		{Label: "光序", Submenu: []*mygo.MenuItem{
			{Label: "显示灯光面板", Click: func(_ *mygo.MenuItem, _ *mygo.Window) { show() }},
			{Type: mygo.MenuItemSeparator},
			{Label: "隐藏光序", Role: mygo.RoleHide},
			{Label: "退出光序", Role: mygo.RoleQuit},
		}},
		{Label: "编辑", Submenu: []*mygo.MenuItem{
			{Label: "撤销", Role: mygo.RoleUndo}, {Label: "重做", Role: mygo.RoleRedo},
			{Label: "剪切", Role: mygo.RoleCut}, {Label: "复制", Role: mygo.RoleCopy},
			{Label: "粘贴", Role: mygo.RolePaste}, {Label: "全选", Role: mygo.RoleSelectAll},
		}},
		{Label: "窗口", Submenu: []*mygo.MenuItem{
			{Label: "最小化", Role: mygo.RoleMinimize}, {Label: "关闭窗口", Role: mygo.RoleClose},
		}},
	}))
	mygo.App.WhenReady(func() {
		window = mygo.NewWindow(mygo.WindowOptions{
			Title: "光序 · 键盘灯光工作室", URL: "/",
			Width: 1240, Height: 900, MinWidth: 1020, MinHeight: 740,
			TitleBarStyle:        mygo.TitleBarHiddenInset,
			TrafficLightPosition: &mygo.Point{X: 22, Y: 22},
			BackgroundColor:      "#f7f9f8", StateKey: "main",
		})
		window.OnClose(func(e *mygo.CloseEvent) {
			if !quitting {
				e.PreventDefault()
				window.Hide()
			}
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Print(err)
	}
}
