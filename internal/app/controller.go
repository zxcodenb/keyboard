package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"unicode/utf8"

	"lightstudio/internal/keyboard"
	"lightstudio/internal/lighting"
)

type Controller struct {
	mu     sync.Mutex
	path   string
	state  Snapshot
	driver keyboard.Driver
	device keyboard.Device
	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}
}

func New(driver keyboard.Driver, path, legacyPath string) (*Controller, error) {
	ctx, cancel := context.WithCancel(context.Background())
	k := &Controller{
		path: path, driver: driver, ctx: ctx, cancel: cancel,
		state: Snapshot{
			Profile: driver.Profile(), Settings: lighting.DefaultSettings(), Presets: []Preset{}, Message: "正在查找设备",
		},
		done: make(chan struct{}),
	}
	if err := k.load(legacyPath); err != nil {
		cancel()
		return nil, err
	}
	return k, nil
}

func (k *Controller) snapshot() Snapshot {
	snapshot := k.state
	snapshot.Profile = snapshot.Profile.Clone()
	snapshot.Settings = lighting.CloneSettings(snapshot.Settings)
	snapshot.Presets = make([]Preset, len(k.state.Presets))
	for i, preset := range k.state.Presets {
		preset.Settings = lighting.CloneSettings(preset.Settings)
		snapshot.Presets[i] = preset
	}
	return snapshot
}

func (k *Controller) Snapshot() (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	return k.snapshot(), nil
}

func (k *Controller) Apply(settings lighting.Settings) (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if err := lighting.ValidateSettings(settings, k.state.Profile.LEDs); err != nil {
		return Snapshot{}, err
	}
	next := k.state
	next.Settings, next.Controlled = lighting.CloneSettings(settings), true
	if err := k.save(next); err != nil {
		return Snapshot{}, err
	}
	return k.snapshot(), nil
}

func (k *Controller) Release() (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	next := k.state
	next.Controlled = false
	if err := k.save(next); err != nil {
		return Snapshot{}, err
	}
	k.closeDevice()
	k.state.Message = "已交还键盘自带灯效"
	return k.snapshot(), nil
}

func (k *Controller) SavePreset(name string, settings lighting.Settings) (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	name = strings.TrimSpace(name)
	if length := utf8.RuneCountInString(name); length < 1 || length > 24 {
		return Snapshot{}, fmt.Errorf("预设名称须为 1 到 24 个字")
	}
	if err := lighting.ValidateSettings(settings, k.state.Profile.LEDs); err != nil {
		return Snapshot{}, err
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return Snapshot{}, err
	}
	id[6], id[8] = id[6]&0x0f|0x40, id[8]&0x3f|0x80
	next := k.state
	next.Presets = append(append([]Preset{}, k.state.Presets...), Preset{
		ID: hex.EncodeToString(id[:]), Name: name, Settings: lighting.CloneSettings(settings),
	})
	if err := k.save(next); err != nil {
		return Snapshot{}, err
	}
	return k.snapshot(), nil
}

func (k *Controller) DeletePreset(id string) (Snapshot, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	next := k.state
	next.Presets = []Preset{}
	for _, preset := range k.state.Presets {
		if preset.ID != id {
			next.Presets = append(next.Presets, preset)
		}
	}
	if err := k.save(next); err != nil {
		return Snapshot{}, err
	}
	return k.snapshot(), nil
}

func (k *Controller) Stop() {
	k.cancel()
	<-k.done
}
