package app

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"lightstudio/internal/lighting"
)

type savedState struct {
	Settings   lighting.Settings `json:"settings"`
	Controlled bool              `json:"controlled"`
	Presets    []Preset          `json:"presets"`
}

func (k *Controller) load(legacyPath string) error {
	data, err := os.ReadFile(k.path)
	if errors.Is(err, os.ErrNotExist) && legacyPath != "" {
		// 只为桌面入口指定的默认用户、默认键盘读取旧配置，不覆盖已分区的配置。
		data, err = os.ReadFile(legacyPath)
	}
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var saved savedState
	if err := json.Unmarshal(data, &saved); err != nil {
		k.state.Message = "本地配置无法读取，已使用默认设置"
		return nil
	}
	if err := lighting.ValidateSettings(saved.Settings, k.state.Profile.LEDs); err != nil {
		k.state.Message = "本地配置无法读取，已使用默认设置"
		return nil
	}
	for _, preset := range saved.Presets {
		if err := lighting.ValidateSettings(preset.Settings, k.state.Profile.LEDs); err != nil {
			k.state.Message = "本地配置无法读取，已使用默认设置"
			return nil
		}
	}
	k.state.Settings, k.state.Controlled = saved.Settings, saved.Controlled
	if saved.Presets != nil {
		k.state.Presets = saved.Presets
	}
	return nil
}

// 调用方持有锁；只有原子替换配置成功后才提交内存状态。
func (k *Controller) save(next Snapshot) error {
	data, err := json.Marshal(savedState{Settings: next.Settings, Controlled: next.Controlled, Presets: next.Presets})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(k.path), 0o755); err != nil {
		return err
	}
	temporary := strings.TrimSuffix(k.path, filepath.Ext(k.path)) + ".tmp"
	defer os.Remove(temporary)
	if err := os.WriteFile(temporary, data, 0o600); err != nil {
		return err
	}
	if err := os.Rename(temporary, k.path); err != nil {
		return err
	}
	k.state = next
	return nil
}
