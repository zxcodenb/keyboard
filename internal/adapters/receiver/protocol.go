package receiver

import (
	"fmt"
	"time"

	"lightstudio/internal/keyboard"
)

// 协议参考 https://github.com/Lightning-13/rk-m75 ，沿用本项目已验证的收发参数。
const (
	vendorID      = 0x3554
	productID     = 0xFA09
	usagePage     = 0xFF02
	reportSize    = 20
	nativePayload = 14
	maxReports    = 18 // 超过此上限可能让键盘卡死。
	reportGap     = 7 * time.Millisecond
)

type colorGroup struct {
	color   keyboard.Color
	indices []byte
}

func groupsToStream(groups []colorGroup) []byte {
	var stream []byte
	for _, group := range groups {
		// 设备要求绿、红、蓝的字节顺序。
		stream = append(stream, group.color[1], group.color[0], group.color[2], byte(len(group.indices)))
		stream = append(stream, group.indices...)
	}
	return stream
}

func packetize(stream []byte) ([][reportSize]byte, error) {
	count := (len(stream) + nativePayload - 1) / nativePayload
	if count > maxReports {
		return nil, fmt.Errorf("需要 %d 个报告，超过安全上限 %d", count, maxReports)
	}
	reports := make([][reportSize]byte, count)
	for seq := range reports {
		report := &reports[seq]
		payload := stream[seq*nativePayload : min((seq+1)*nativePayload, len(stream))]
		report[0], report[1], report[2], report[3] = 0x13, 0x88, byte(count), byte(seq)
		report[4] = 0x10 + byte(len(payload))
		copy(report[5:19], payload)
		for _, value := range report[:19] {
			report[19] += value
		}
	}
	return reports, nil
}

func frameReports(frame []keyboard.Pixel) ([][][reportSize]byte, error) {
	// 按灯珠索引首次遇到颜色的顺序分组，避免映射遍历造成报告顺序随机变化。
	var groups []colorGroup
	positions := make(map[keyboard.Color]int)
	for _, pixel := range frame {
		if pixel.Index < 0 || pixel.Index > 255 {
			return nil, fmt.Errorf("此协议不支持灯珠索引 %d", pixel.Index)
		}
		color := pixel.Color
		position, ok := positions[color]
		if !ok || len(groups[position].indices) == maxReports*nativePayload-4 {
			position = len(groups)
			positions[color] = position
			groups = append(groups, colorGroup{color: color})
		}
		groups[position].indices = append(groups[position].indices, byte(pixel.Index))
	}
	var transactions [][][reportSize]byte
	for len(groups) > 0 {
		count, size := 0, 0
		for count < len(groups) && size+4+len(groups[count].indices) <= maxReports*nativePayload {
			size += 4 + len(groups[count].indices)
			count++
		}
		reports, err := packetize(groupsToStream(groups[:count]))
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, reports)
		groups = groups[count:]
	}
	return transactions, nil
}
