#!/usr/bin/env python3
"""R98 键盘参数读写工具。

用法:
  send.py read                    # 读 Feature Report 0x06 的 7 字节状态
  send.py write <7字节HEX>        # 写 Feature Report 0x06，例: write 00 02 32 64 64 35 25
  send.py out   <19字节HEX>       # 写 Output Report 0x13

每次写入前会自动把原值打印出来并存入 last_state.txt，便于回滚。
"""
import sys
import hid

VID, PID = 0x3554, 0xFA09
FEATURE_RID = 0x06
FEATURE_LEN = 7
OUTPUT_RID = 0x13
OUTPUT_LEN = 19


def hx(b):
    return " ".join("%02x" % x for x in b)


def open_dev():
    devs = hid.enumerate(VID, PID)
    path = next(d["path"] for d in devs if d.get("usage_page") == 0xFF02)
    dev = hid.device()
    dev.open_path(path)
    return dev


def parse_hex(args, n):
    out = [int(a, 16) for a in args]
    if len(out) != n:
        sys.exit("需要 %d 字节，收到 %d 字节" % (n, len(out)))
    if any(x > 0xFF for x in out):
        sys.exit("字节必须在 00-ff 之间")
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    dev = open_dev()
    try:
        cur = dev.get_feature_report(FEATURE_RID, FEATURE_LEN + 1)
        print("写入前状态: " + hx(cur))
        open("last_state.txt", "w").write(hx(cur) + "\n")

        cmd = sys.argv[1]
        if cmd == "read":
            pass
        elif cmd == "write":
            payload = parse_hex(sys.argv[2:], FEATURE_LEN)
            n = dev.send_feature_report([FEATURE_RID] + payload)
            print("已发 Feature Report: %d 字节 -> %s" % (n, hx(payload)))
        elif cmd == "out":
            payload = parse_hex(sys.argv[2:], OUTPUT_LEN)
            n = dev.write([OUTPUT_RID] + payload)
            print("已发 Output Report: %d 字节 -> %s" % (n, hx(payload)))
        else:
            sys.exit(__doc__)

        after = dev.get_feature_report(FEATURE_RID, FEATURE_LEN + 1)
        print("写入后状态: " + hx(after))
    finally:
        dev.close()


if __name__ == "__main__":
    main()
