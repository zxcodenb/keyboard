"""设备连接与灯光帧的持续写入。"""
import time

import hid

from .protocol import GAP_MS, PID, REPORT_SIZE, USAGE_PAGE, VID, packetize


def open_dev():
    """打开厂商私有接口（usage page 0xFF02）。"""
    devs = hid.enumerate(VID, PID)
    path = next(d["path"] for d in devs if d.get("usage_page") == USAGE_PAGE)
    dev = hid.device()
    dev.open_path(path)
    return dev


def device_present():
    """只判断接收器在不在，不打开设备。"""
    return any(d.get("usage_page") == USAGE_PAGE for d in hid.enumerate(VID, PID))


def pump(stream, hold):
    """持续重发该帧，直到 hold 秒过去（hold=0 表示不设时限），返回发送的帧数。

    键盘不接受一次性写入：停发后会自动回到自带灯效，所以必须保持重发。
    """
    reports = packetize(stream)
    deadline = None if hold == 0 else time.monotonic() + hold
    dev = None
    frames = 0
    try:
        while True:
            if dev is None:
                try:
                    dev = open_dev()
                except Exception:
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
                return frames
            time.sleep(0.2)
    finally:
        if dev is not None:
            dev.close()
