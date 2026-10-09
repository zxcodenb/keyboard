#!/usr/bin/env python3
"""R98 键盘 2.4G 接收器 HID 探针：枚举接口、dump 描述符、试读 feature report。"""
import sys
import hid

VID, PID = 0x3554, 0xFA09


def hexdump(b):
    return " ".join("%02x" % x for x in b)


def main():
    devs = hid.enumerate(VID, PID)
    if not devs:
        print("未找到设备 VID=0x%04X PID=0x%04X" % (VID, PID))
        return 1

    seen = set()
    for d in devs:
        key = (d.get("usage_page"), d.get("usage"), d.get("interface_number"))
        if key in seen:
            continue
        seen.add(key)
        print("---")
        for k in ("path", "interface_number", "usage_page", "usage",
                  "manufacturer_string", "product_string", "serial_number",
                  "release_number"):
            v = d.get(k)
            if k == "path":
                v = v.decode(errors="replace") if isinstance(v, bytes) else v
            print("  %-18s %s" % (k, v))

    print("\n=== 打开 vendor 接口 (0xFF02 / usage 0x02) ===")
    target = next((d for d in devs if d.get("usage_page") == 0xFF02), None)
    if not target:
        print("没有 0xFF02 接口")
        return 1

    dev = hid.device()
    dev.open_path(target["path"])
    print("已打开:", dev.get_product_string() if hasattr(dev, "get_product_string") else "")

    print("\n=== get_feature_report 试探 ===")
    for rid, size in ((0x06, 8), (0x13, 20), (0x00, 64)):
        try:
            got = dev.get_feature_report(rid, size)
            print("  rid=0x%02x -> len=%d  %s" % (rid, len(got), hexdump(got)))
        except Exception as e:
            print("  rid=0x%02x -> 失败: %s" % (rid, e))

    dev.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
