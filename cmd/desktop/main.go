package main

import (
	"log"
	"path/filepath"

	"github.com/egoist/mygo"

	"lightstudio/internal/adapters/receiver"
	"lightstudio/internal/app"
	"lightstudio/internal/desktop"
	"lightstudio/profiles"
)

func main() {
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	stateDir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		log.Print(err)
		return
	}
	profile, err := profiles.Load("receiver-3554-fa09")
	if err != nil {
		log.Print(err)
		return
	}
	// 系统用户目录天然隔离；本地工作空间和键盘档案分别占据独立路径段。
	userID := "local"
	statePath := filepath.Join(stateDir, "users", userID, "keyboards", profile.ID, "lighting.json")
	legacyPath := ""
	if userID == "local" && profile.ID == "receiver-3554-fa09" {
		legacyPath = filepath.Join(stateDir, "lighting.json")
	}
	controller, err := app.New(receiver.New(profile), statePath, legacyPath)
	if err != nil {
		log.Print(err)
		return
	}
	started := false
	defer func() {
		if started {
			controller.Stop()
		}
	}()
	mygo.Bind(desktop.NewKeyboard(controller))
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
		// 生成前端绑定时不会进入此回调，也不会枚举或打开接收器。
		started = true
		go controller.Run()
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
