// Package profiles 提供后端和界面共用的键盘档案。
package profiles

import (
	"embed"
	"encoding/json"
	"fmt"

	"lightstudio/internal/keyboard"
)

//go:embed *.json
var files embed.FS

func Load(id string) (keyboard.Profile, error) {
	var profile keyboard.Profile
	data, err := files.ReadFile(id + ".json")
	if err != nil {
		return profile, err
	}
	if err := json.Unmarshal(data, &profile); err != nil {
		return profile, err
	}
	if profile.ID != id {
		return profile, fmt.Errorf("键盘档案标识不匹配：%s", id)
	}
	return profile, nil
}
