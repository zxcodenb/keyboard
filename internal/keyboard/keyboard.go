// Package keyboard 定义与品牌、协议及桌面框架无关的键盘数据和适配器边界。
package keyboard

import (
	"context"
	"slices"
)

type Color [3]byte

type Pixel struct {
	Index int
	Color Color
}

type LED struct {
	Index    int     `json:"index"`
	Position float64 `json:"position"` // 流光的归一化横向位置，不从设备索引推算。
}

type Key struct {
	Name  string  `json:"name"`
	Label string  `json:"label"`
	Index int     `json:"index"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	W     float64 `json:"w"`
	H     float64 `json:"h"`
	Group string  `json:"group"`
	Note  string  `json:"note"`
}

type Group struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Profile struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	Connection    string  `json:"connection"`
	Brand         string  `json:"brand"`
	BrandName     string  `json:"brandName"`
	Width         float64 `json:"width"`
	Height        float64 `json:"height"`
	DisplayHeight float64 `json:"displayHeight"`
	Note          string  `json:"note"`
	Groups        []Group `json:"groups"`
	Keys          []Key   `json:"keys"`
	LEDs          []LED   `json:"leds"`
}

func (p Profile) Clone() Profile {
	p.Keys, p.LEDs, p.Groups = slices.Clone(p.Keys), slices.Clone(p.LEDs), slices.Clone(p.Groups)
	return p
}

// Driver 的生命周期由当前活动控制器管理；初始化和退出在同一协程执行。
// 设备收发、线程要求和具体协议由适配器实现。
type Driver interface {
	Profile() Profile
	Init() error
	Exit() error
	Present() (bool, error)
	Open() (Device, error)
}

type Device interface {
	WriteFrame(context.Context, []Pixel) error
	Close() error
}
