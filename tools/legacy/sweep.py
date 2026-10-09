#!/usr/bin/env python3
"""逐点标定 RK R98 的 LED 索引 -> 键名。

在终端里跑：
    .venv/bin/python tools/legacy/sweep.py            # 标定索引 84-149（右侧区块）
    .venv/bin/python tools/legacy/sweep.py 0 101      # 指定范围

每个索引单独点亮（红色，持续到你按回车），你照着键盘输入键名：
    直接输入键名 + 回车   记录
    直接回车             跳过（该索引无灯或看不清）
    q + 回车             提前结束

结果保存到fixtures/receiver-3554-fa09-keymap.json，下次运行会接着已有的进度。
"""
import json
import os
import sys
import threading
import time

# 从同目录载入旧版接收器实现。
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
import receiver

PATH = os.path.join(ROOT, "fixtures", "receiver-3554-fa09-keymap.json")

# 终端里按方向键等会读成 ANSI 转义序列，这里翻译回键名
FIX = {
    "\x1b[A": "up", "\x1b[B": "down", "\x1b[C": "right", "\x1b[D": "left",
    "\x1b[2~": "insert", "\x1b[3~": "delete",
    "\x1b[H": "home", "\x1b[F": "end",
    "\x1b[5~": "pgup", "\x1b[6~": "pgdn",
}


def normalize(s):
    """把终端转义序列换成键名，其余统一小写。"""
    s = s.strip()
    for seq, name in FIX.items():
        if s.startswith(seq):
            return name
    return s.lower()


def load():
    if os.path.exists(PATH):
        with open(PATH) as f:
            return json.load(f)
    return {}


def save(data):
    with open(PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)


def start_lamp(index):
    """后台线程持续把该索引刷成红色，直到 stop 事件被设置。"""
    stop = threading.Event()

    def run():
        stream = receiver.groups_to_stream([((255, 0, 0), [index])])
        reports = receiver.packetize(stream)
        dev = None
        while not stop.is_set():
            if dev is None:
                try:
                    dev = receiver.open_dev()
                except Exception:
                    time.sleep(0.5)
                    continue
            try:
                for i, r in enumerate(reports):
                    dev.write(list(r))
                    if i + 1 < len(reports):
                        time.sleep(receiver.GAP_MS / 1000.0)
            except OSError:
                try:
                    dev.close()
                except Exception:
                    pass
                dev = None
                time.sleep(0.3)
                continue
            time.sleep(0.2)
        if dev is not None:
            dev.close()

    t = threading.Thread(target=run, daemon=True)
    t.start()
    return stop


def main():
    if len(sys.argv) == 3:
        lo, hi = int(sys.argv[1]), int(sys.argv[2])
    elif len(sys.argv) == 1:
        lo, hi = 84, 149
    else:
        sys.exit(__doc__)

    data = load()
    done = {int(k) for k in data}
    print("已有 %d 个索引标定完成" % len(done))

    for index in range(lo, hi + 1):
        if index in done:
            continue
        stop = start_lamp(index)
        time.sleep(0.4)
        try:
            answer = normalize(input("索引 %3d 亮红 -> 键名（回车跳过 / q 结束）: " % index))
        finally:
            stop.set()
            time.sleep(0.4)
        if answer == "q":
            break
        if answer:
            data[str(index)] = answer
            save(data)
            print("   已记录: %s = %s" % (index, answer))

    save(data)
    print("\n标定结果已写入 %s（共 %d 条）" % (PATH, len(data)))


if __name__ == "__main__":
    main()
