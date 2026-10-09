#!/usr/bin/env python3
"""只读扫描：遍历所有 Feature Report ID，记录设备返回的状态。"""
import hid

VID, PID = 0x3554, 0xFA09
TARGET = 0xFF02  # vendor collection 所在接口


def main():
    devs = hid.enumerate(VID, PID)
    path = next(d["path"] for d in devs if d.get("usage_page") == TARGET)

    dev = hid.device()
    dev.open_path(path)

    print("== 静态字段 ==")
    for f in ("get_manufacturer_string", "get_product_string", "get_serial_number_string"):
        try:
            print("  %-26s %r" % (f, getattr(dev, f)()))
        except Exception as e:
            print("  %-26s <err %s>" % (f, e))

    print("\n== Feature Report ID 扫描 (reportID 0x00-0x20) ==")
    for rid in range(0x21):
        for size in (8, 20, 64, 256):
            try:
                got = dev.get_feature_report(rid, size)
            except Exception as e:
                if size == 8:
                    print("  0x%02x: err %s" % (rid, e))
                break
            if got and any(got[1:]):
                print("  0x%02x (len=%3d): %s" % (rid, len(got),
                      " ".join("%02x" % b for b in got)))
                break

    print("\n== 稳定性：连续读 0x06 五次 ==")
    for i in range(5):
        got = dev.get_feature_report(0x06, 8)
        print("  第%d次: %s" % (i + 1, " ".join("%02x" % b for b in got)))

    dev.close()


if __name__ == "__main__":
    main()
