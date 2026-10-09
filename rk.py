#!/usr/bin/env python3
"""RK R98 三模键盘 2.4G 灯光控制。

协议逆向自 https://github.com/Lightning-13/rk-m75 ，并在本机 RK R98 上实测验证。

索引规律（已逐点验证）:
    索引 = 列号 * 6 + 行号
    行号: 0=F区  1=数字行  2=QWERTY行  3=Home行  4=Bottom行  5=底行

事务格式:
    13 88 XX              XX = 本事务的报告数
    seq                   序列号，从 0 开始
    0x10 + payload_len    载荷长度（1..14）
    payload               原生 RGB 数据
    sum(前19字节) & 0xFF  累加校验和

原生流格式（每组）:
    G R B   LED数量   LED索引...

注意: 颜色字节序是 GRB，不是 RGB。

用法:
    rk.py fill red              全键盘红色
    rk.py set esc blue          Esc 蓝色
    rk.py set kp5 00ff00        小键盘 5 绿色
    rk.py set 12 00ff00         索引 12 绿色
    rk.py off                   全灭
    rk.py raw 00 ff 00 01 06    直接发原生流
    通用选项: --hold 秒(默认10)  --stay(持续到 Ctrl+C)
"""
import sys
import time
import hid

VID, PID = 0x3554, 0xFA09
USAGE_PAGE = 0xFF02
REPORT_SIZE = 20
NATIVE_PAYLOAD = 14
MAX_REPORTS = 18          # 逆向项目验证过的安全上限，超过会让键盘卡死
GAP_MS = 7.0              # 逆向项目验证过的报告间隔
LED_COUNT = 102           # 覆盖索引 0..101

COLORS = {
    "off": (0, 0, 0), "black": (0, 0, 0),
    "red": (255, 0, 0), "green": (0, 255, 0), "blue": (0, 0, 255),
    "yellow": (255, 255, 0), "cyan": (0, 255, 255), "magenta": (255, 0, 255),
    "white": (255, 255, 255), "orange": (255, 128, 0), "purple": (128, 0, 255),
}

# 索引 = 列号 * 6 + 行号。以下为已实测 / 与 RK M75 交叉验证的键位。
KEYMAP = {
    # 列 0
    "esc": 0, "`": 1, "tab": 2, "caps": 3, "lshift": 4, "lctrl": 5,
    # 列 1
    "f1": 6, "1": 7, "q": 8, "a": 9, "z": 10, "lwin": 11,
    # 列 2
    "f2": 12, "2": 13, "w": 14, "s": 15, "x": 16, "lalt": 17,
    # 列 3 及以后（与 M75 同构，R98 上未逐点核对）
    "f3": 18, "3": 19, "e": 20, "d": 21, "c": 22,
    "f4": 24, "4": 25, "r": 26, "f": 27, "v": 28,
    "f5": 30, "5": 31, "t": 32, "g": 33, "b": 34, "space": 35,
    "f6": 36, "6": 37, "y": 38, "h": 39, "n": 40,
    "f7": 42, "7": 43, "u": 44, "j": 45, "m": 46,
    "f8": 48, "8": 49, "i": 50, "k": 51, ",": 52, "ralt": 53,
    "f9": 54, "9": 55, "o": 56, "l": 57, ".": 58, "fn": 59,
    "f10": 60, "0": 61, "p": 62, ";": 63, "/": 64, "rctrl": 65,
    "f11": 66, "-": 67, "[": 68, "'": 69,
    "f12": 72, "=": 73, "]": 74,
    "backspace": 79, "\\": 80, "enter": 81, "rshift": 82, "left": 83,
}

# 右侧区块（索引 84 起）。R98 在此与 RK M75 不同，以下为逐点实测结果：
#   M75 的 91/92/93 是 HOME/PAGE_UP/PAGE_DOWN，R98 是 numlock/7/4；
#   小键盘键名加 kp 前缀，避开与主键区重名。
NUMPAD = {
    "up": 88, "down": 89, "right": 95,
    "insert": 90, "numlock": 91, "print": 96,
    "pgup": 102, "pgdn": 108,
    "kpslash": 97, "kpstar": 103, "kpminus": 109, "kpplus": 110,
    "kp7": 92, "kp8": 98, "kp9": 104,
    "kp4": 93, "kp5": 99, "kp6": 105,
    "kp1": 94, "kp2": 100, "kp3": 106,
    "kp0": 101, "kpdot": 107, "kpenter": 112,
}


def parse_color(token):
    """颜色名或 6 位十六进制 -> (R, G, B)。"""
    key = token.lower()
    if key in COLORS:
        return COLORS[key]
    if len(token) == 6:
        return tuple(int(token[i:i + 2], 16) for i in (0, 2, 4))
    raise SystemExit("无法识别的颜色: %s" % token)


def groups_to_stream(groups):
    """[(rgb, [索引...]), ...] -> 原生流。"""
    out = bytearray()
    for (r, g, b), indices in groups:
        out += bytes((g, r, b))          # GRB
        out.append(len(indices))
        out += bytes(indices)
    return bytes(out)


def packetize(stream):
    """原生流 -> 20 字节 HID 报告序列。"""
    n = (len(stream) + NATIVE_PAYLOAD - 1) // NATIVE_PAYLOAD
    if n > MAX_REPORTS:
        raise SystemExit("需要 %d 个报告，超过安全上限 %d" % (n, MAX_REPORTS))
    reports = []
    for seq in range(n):
        r = bytearray(REPORT_SIZE)
        r[0:3] = bytes((0x13, 0x88, n))
        r[3] = seq
        payload = stream[seq * NATIVE_PAYLOAD:(seq + 1) * NATIVE_PAYLOAD]
        r[4] = 0x10 + len(payload)
        r[5:5 + len(payload)] = payload
        r[19] = sum(r[:19]) & 0xFF
        reports.append(bytes(r))
    return reports


def open_dev():
    devs = hid.enumerate(VID, PID)
    path = next(d["path"] for d in devs if d.get("usage_page") == USAGE_PAGE)
    dev = hid.device()
    dev.open_path(path)
    return dev


def pump(stream, hold):
    """持续重发该帧；hold=0 表示一直发到 Ctrl+C。"""
    reports = packetize(stream)
    print("原生流 %d 字节 -> %d 个报告" % (len(stream), len(reports)), flush=True)
    deadline = None if hold == 0 else time.monotonic() + hold
    dev = None
    frames = 0
    try:
        while True:
            if dev is None:
                try:
                    dev = open_dev()
                except Exception as e:
                    time.sleep(0.5)
                    continue
            try:
                for i, r in enumerate(reports):
                    if dev.write(list(r)) != REPORT_SIZE:
                        raise IOError("写入字节数不符")
                    if i + 1 < len(reports):
                        time.sleep(GAP_MS / 1000.0)
            except OSError:
                try:
                    dev.close()
                except Exception:
                    pass
                dev = None
                time.sleep(0.3)
                continue
            frames += 1
            if deadline is not None and time.monotonic() >= deadline:
                break
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\n已停止（键盘将回到自带灯效）")
    finally:
        if dev is not None:
            dev.close()
    print("共发送 %d 帧" % frames)


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)

    hold = 10.0
    if "--stay" in args:
        args.remove("--stay")
        hold = 0.0
    if "--hold" in args:
        i = args.index("--hold")
        hold = float(args[i + 1])
        del args[i:i + 2]

    cmd = args.pop(0)

    if cmd == "fill":
        color = parse_color(args[0])
        stream = groups_to_stream([(color, list(range(LED_COUNT)))])
    elif cmd == "off":
        stream = groups_to_stream([((0, 0, 0), list(range(LED_COUNT)))])
    elif cmd == "set":
        target = args[0].lower()
        index = KEYMAP.get(target)
        if index is None:
            index = NUMPAD.get(target)
        if index is None:
            index = int(target)
        stream = groups_to_stream([(parse_color(args[1]), [index])])
    elif cmd == "raw":
        stream = bytes(int(x, 16) for x in args)
    else:
        sys.exit(__doc__)

    pump(stream, hold)


if __name__ == "__main__":
    main()
