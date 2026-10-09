package app

import (
	"lightstudio/internal/keyboard"
	"lightstudio/internal/lighting"
)

type Preset struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Settings lighting.Settings `json:"settings"`
}

type Snapshot struct {
	Profile    keyboard.Profile  `json:"profile"`
	Settings   lighting.Settings `json:"settings"`
	Controlled bool              `json:"controlled"`
	Connected  bool              `json:"connected"`
	Sending    bool              `json:"sending"`
	Message    string            `json:"message"`
	Presets    []Preset          `json:"presets"`
}
