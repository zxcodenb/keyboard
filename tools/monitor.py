#!/usr/bin/env python3
"""轮询 Feature Report 0x06，任何字节变化都带时间戳打印出来。

用法: monitor.py [持续秒数]
"""
import sys
import time
import hid

VID, PID = 0x3554, 0xFA09


def main():
    duration = float(sys.argv[1]) if len(sys.argv) > 1 else 30.0

    devs = hid.enumerate(VID, PID)
    path = next(d["path"] for d in devs if d.get("usage_page") == 0xFF02)
    dev = hid.device()
    dev.open_path(path)

    last = None
    t0 = time.time()
    while time.time() - t0 < duration:
        try:
            v = list(dev.get_feature_report(0x06, 8))
        except OSError as e:
            print("%s 读失败: %s" % (time.strftime("%H:%M:%S"), e), flush=True)
            time.sleep(0.2)
            continue
        if v != last:
            print("%s  %s" % (time.strftime("%H:%M:%S"), " ".join("%02x" % b for b in v)), flush=True)
            last = v
        time.sleep(0.08)
    dev.close()
    print("== 结束 ==", flush=True)


if __name__ == "__main__":
    main()
