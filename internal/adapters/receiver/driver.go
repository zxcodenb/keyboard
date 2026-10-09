// Package receiver 适配标识为 3554:fa09 的厂商私有接收器协议，不代表所有无线键盘。
package receiver

import (
	"context"
	"io"
	"runtime"
	"time"

	"github.com/sstallion/go-hid"

	"lightstudio/internal/keyboard"
)

type Driver struct {
	profile keyboard.Profile
}

func New(profile keyboard.Profile) *Driver {
	return &Driver{profile: profile.Clone()}
}

func (d *Driver) Profile() keyboard.Profile { return d.profile.Clone() }

// 苹果系统的设备管理器绑定线程事件循环，适配器的整个运行周期固定在同一线程。
func (d *Driver) Init() error {
	runtime.LockOSThread()
	if err := hid.Init(); err != nil {
		runtime.UnlockOSThread()
		return err
	}
	return nil
}

func (d *Driver) Exit() error {
	defer runtime.UnlockOSThread()
	return hid.Exit()
}

func receiverPath() (string, error) {
	var path string
	err := hid.Enumerate(vendorID, productID, func(info *hid.DeviceInfo) error {
		if path == "" && info.UsagePage == usagePage {
			path = info.Path
		}
		return nil
	})
	return path, err
}

func (d *Driver) Present() (bool, error) {
	path, err := receiverPath()
	return path != "", err
}

func (d *Driver) Open() (keyboard.Device, error) {
	path, err := receiverPath()
	if err != nil {
		return nil, err
	}
	device, err := hid.OpenPath(path)
	if err != nil {
		return nil, err
	}
	return &deviceConnection{device: device}, nil
}

type deviceConnection struct {
	device *hid.Device
}

func (d *deviceConnection) Close() error { return d.device.Close() }

func (d *deviceConnection) WriteFrame(ctx context.Context, frame []keyboard.Pixel) error {
	transactions, err := frameReports(frame)
	if err != nil {
		return err
	}
	for _, reports := range transactions {
		// 在事务边界响应退出，不留下发送到一半的事务。
		if err := ctx.Err(); err != nil {
			return err
		}
		for _, report := range reports {
			// 首字节 0x13 已是报告标识，不能额外补零。
			written, err := d.device.Write(report[:])
			if err != nil {
				return err
			}
			if written != reportSize {
				return io.ErrShortWrite
			}
			time.Sleep(reportGap)
		}
	}
	return nil
}
