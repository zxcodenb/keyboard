"""RK R98 三模键盘 2.4G 灯光控制的命令行入口。

用法:
    .venv/bin/python -m rk98 fill red               全键盘红色
    .venv/bin/python -m rk98 set esc blue           Esc 蓝色
    .venv/bin/python -m rk98 set kp5 00ff00         小键盘 5 绿色
    .venv/bin/python -m rk98 set 12 00ff00          索引 12 绿色
    .venv/bin/python -m rk98 off                    全灭
    .venv/bin/python -m rk98 raw 00 ff 00 01 06     直接发原生流
通用选项: --hold 秒（默认 10）  --stay（持续到 Ctrl+C）
"""
import sys

from .device import pump
from .protocol import KEYMAP, LED_COUNT, NUMPAD, groups_to_stream, packetize, parse_color


def build_stream(args):
    """命令与参数 -> 原生流。"""
    cmd = args.pop(0)
    if cmd == "fill":
        return groups_to_stream([(parse_color(args[0]), list(range(LED_COUNT)))])
    if cmd == "off":
        return groups_to_stream([((0, 0, 0), list(range(LED_COUNT)))])
    if cmd == "set":
        target = args[0].lower()
        index = KEYMAP.get(target)
        if index is None:
            index = NUMPAD.get(target)
        if index is None:
            index = int(target)
        return groups_to_stream([(parse_color(args[1]), [index])])
    if cmd == "raw":
        return bytes(int(x, 16) for x in args)
    sys.exit(__doc__)


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

    stream = build_stream(args)
    print("原生流 %d 字节 -> %d 个报告" % (len(stream), len(packetize(stream))))
    try:
        frames = pump(stream, hold)
    except KeyboardInterrupt:
        print("\n已停止（键盘将回到自带灯效）")
        return
    print("共发送 %d 帧" % frames)


if __name__ == "__main__":
    main()
