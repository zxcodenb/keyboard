package app

import (
	"fmt"
	"time"

	"lightstudio/internal/lighting"
)

// 设备操作持有同一把锁，事务不会与释放或另一帧交错。
func (k *Controller) closeDevice() {
	if k.device != nil {
		k.device.Close()
		k.device = nil
	}
	k.state.Sending = false
}

func (k *Controller) syncFrame(elapsed float64) error {
	if !k.state.Controlled {
		k.closeDevice()
		present, err := k.driver.Present()
		if err != nil {
			return err
		}
		k.state.Connected = present
		k.state.Message = "未找到设备，请检查连接"
		if present {
			k.state.Message = "设备已连接 · 使用键盘自带灯效"
		}
		return nil
	}
	if k.device == nil {
		present, err := k.driver.Present()
		if err != nil {
			return err
		}
		if !present {
			k.state.Connected = false
			k.state.Message = "未找到设备，正在等待重新连接"
			return nil
		}
		k.device, err = k.driver.Open()
		if err != nil {
			return err
		}
	}
	frame := lighting.Frame(k.state.Settings, k.state.Profile.LEDs, elapsed)
	if err := k.device.WriteFrame(k.ctx, frame); err != nil {
		return err
	}
	k.state.Connected, k.state.Sending = true, true
	k.state.Message = "正在持续同步灯光"
	if !k.state.Settings.Power {
		k.state.Message = "灯光已关闭"
	}
	return nil
}

func (k *Controller) Run() {
	defer close(k.done)
	if err := k.driver.Init(); err != nil {
		k.mu.Lock()
		k.state.Message = fmt.Sprintf("设备访问失败：%s", err)
		k.mu.Unlock()
		return
	}
	defer k.driver.Exit()
	defer func() {
		k.mu.Lock()
		defer k.mu.Unlock()
		k.closeDevice()
	}()
	started := time.Now()
	for {
		select {
		case <-k.ctx.Done():
			return
		default:
		}
		k.mu.Lock()
		err := k.syncFrame(time.Since(started).Seconds())
		if err != nil && k.ctx.Err() == nil {
			k.closeDevice()
			k.state.Connected = false
			k.state.Message = fmt.Sprintf("设备访问失败：%s。请检查设备连接及系统访问权限。", err)
		}
		delay := time.Second
		if k.state.Controlled && k.state.Sending {
			delay = 200 * time.Millisecond
		}
		k.mu.Unlock()
		timer := time.NewTimer(delay)
		select {
		case <-k.ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
