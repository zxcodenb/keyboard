package lighting

import (
	"encoding/hex"
	"fmt"
	"maps"
	"math"
	"strconv"

	"lightstudio/internal/keyboard"
)

func DefaultSettings() Settings {
	return Settings{
		Mode: "solid", Color: "#80e8c0", Secondary: "#7e9bff",
		Brightness: 70, Speed: 45, Power: true, Overrides: map[string]string{},
	}
}

func CloneSettings(settings Settings) Settings {
	settings.Overrides = maps.Clone(settings.Overrides)
	return settings
}

func parseColor(color string) (keyboard.Color, error) {
	if len(color) != 7 || color[0] != '#' {
		return keyboard.Color{}, fmt.Errorf("颜色须为六位十六进制值")
	}
	value, err := hex.DecodeString(color[1:])
	if err != nil {
		return keyboard.Color{}, fmt.Errorf("颜色须为六位十六进制值")
	}
	return keyboard.Color{value[0], value[1], value[2]}, nil
}

func ValidateSettings(settings Settings, leds []keyboard.LED) error {
	if settings.Mode != "solid" && settings.Mode != "breathe" && settings.Mode != "wave" {
		return fmt.Errorf("不支持的灯光效果")
	}
	for _, color := range []string{settings.Color, settings.Secondary} {
		if _, err := parseColor(color); err != nil {
			return err
		}
	}
	if settings.Brightness < 0 || settings.Brightness > 100 || settings.Speed < 0 || settings.Speed > 100 {
		return fmt.Errorf("亮度和速度须在 0 到 100 之间")
	}
	if settings.Overrides == nil {
		return fmt.Errorf("灯光设置格式错误")
	}
	indices := make(map[int]bool, len(leds))
	for _, led := range leds {
		indices[led.Index] = true
	}
	for key, color := range settings.Overrides {
		index, err := strconv.Atoi(key)
		if err != nil || index < 0 || strconv.Itoa(index) != key || !indices[index] {
			return fmt.Errorf("未知的灯珠索引")
		}
		if _, err := parseColor(color); err != nil {
			return fmt.Errorf("单键颜色格式错误")
		}
	}
	return nil
}

func Frame(settings Settings, leds []keyboard.LED, elapsed float64) []keyboard.Pixel {
	const tau = 2 * math.Pi
	// 设置在应用或载入时已经验证。
	a, _ := parseColor(settings.Color)
	b, _ := parseColor(settings.Secondary)
	period := 8 - float64(settings.Speed)*0.06
	level := float64(settings.Brightness) / 100
	if !settings.Power {
		level = 0
	}
	if settings.Mode == "breathe" {
		level *= 0.15 + 0.85*(1-math.Cos(elapsed/period*tau))/2
	}
	colors := make([]keyboard.Pixel, len(leds))
	for i, led := range leds {
		colors[i].Index = led.Index
		color := a
		if settings.Mode == "wave" {
			// 八级色阶限制报告数量；取偶舍入与原脚本保持一致。
			mix := math.RoundToEven((math.Sin(led.Position*tau-elapsed/period*tau)+1)*3.5) / 7
			for channel := range color {
				color[channel] = byte(math.RoundToEven(float64(a[channel]) + (float64(b[channel])-float64(a[channel]))*mix))
			}
		}
		if override, ok := settings.Overrides[strconv.Itoa(led.Index)]; ok {
			color, _ = parseColor(override)
		}
		for channel := range color {
			colors[i].Color[channel] = byte(math.RoundToEven(float64(color[channel]) * level))
		}
	}
	return colors
}
