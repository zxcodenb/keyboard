package app_test

import (
	"path/filepath"
	"testing"

	"lightstudio/internal/adapters/receiver"
	"lightstudio/internal/app"
	"lightstudio/internal/lighting"
	"lightstudio/profiles"
)

func TestKeyboardApplyAndError(t *testing.T) {
	// 原进程通信断言改为直接调用；不启动设备循环。
	profile, err := profiles.Load("receiver-3554-fa09")
	if err != nil {
		t.Fatal(err)
	}
	k, err := app.New(receiver.New(profile), filepath.Join(t.TempDir(), "lighting.json"), "")
	if err != nil {
		t.Fatal(err)
	}
	settings := lighting.DefaultSettings()
	settings.Color, settings.Brightness = "#aabbcc", 42
	settings.Overrides = map[string]string{"112": "#ff0000"}
	result, err := k.Apply(settings)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Controlled || result.Settings.Overrides["112"] != "#ff0000" || result.Settings.Brightness != 42 {
		t.Fatalf("控制器返回数据不一致：%+v", result)
	}
	settings.Mode = "bad"
	if _, err := k.Apply(settings); err == nil || err.Error() != "不支持的灯光效果" {
		t.Fatalf("控制器未返回错误：%v", err)
	}
}
