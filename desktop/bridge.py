#!/usr/bin/env python3
"""桌面程序的本地控制桥；复用 rk.py，不修改键盘固件或板载配置。"""
import copy
import json
import math
import os
from pathlib import Path
import re
import sys
import threading
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import rk

# 覆盖原脚本的全部索引及已实测的右侧区块，不遗漏索引 102 之后的灯。
INDICES = sorted(set(range(rk.LED_COUNT)) | set(rk.KEYMAP.values()) | set(rk.NUMPAD.values()))
DEFAULT = {"mode": "solid", "color": "#80e8c0", "secondary": "#7e9bff",
           "brightness": 70, "speed": 45, "power": True, "overrides": {}}


def validate(settings):
    if not isinstance(settings, dict) or set(settings) != set(DEFAULT):
        raise ValueError("灯光设置不完整")
    if settings["mode"] not in ("solid", "breathe", "wave"):
        raise ValueError("不支持的灯光效果")
    for field in ("color", "secondary"):
        if not isinstance(settings[field], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", settings[field]):
            raise ValueError("颜色须为六位十六进制值")
    for field in ("brightness", "speed"):
        if type(settings[field]) is not int or not 0 <= settings[field] <= 100:
            raise ValueError("亮度和速度须在 0 到 100 之间")
    if type(settings["power"]) is not bool or not isinstance(settings["overrides"], dict):
        raise ValueError("灯光设置格式错误")
    for key, color in settings["overrides"].items():
        if key not in {str(i) for i in INDICES}:
            raise ValueError("未知的灯珠索引")
        if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise ValueError("单键颜色格式错误")
    return copy.deepcopy(settings)


def frame_colors(settings, elapsed):
    a = rk.parse_color(settings["color"][1:])
    b = rk.parse_color(settings["secondary"][1:])
    period = 8 - settings["speed"] * 0.06
    level = settings["brightness"] / 100 if settings["power"] else 0
    if settings["mode"] == "breathe":
        level *= 0.15 + 0.85 * (1 - math.cos(elapsed / period * math.tau)) / 2
    colors = {}
    for index in INDICES:
        color = a
        if settings["mode"] == "wave":
            # 八级色阶限制报告数量，避免为了预览的流畅度超频写入设备。
            mix = round((math.sin(index // 6 / 18 * math.tau - elapsed / period * math.tau) + 1) * 3.5) / 7
            color = tuple(round(x + (y - x) * mix) for x, y in zip(a, b))
        if str(index) in settings["overrides"]:
            color = rk.parse_color(settings["overrides"][str(index)][1:])
        colors[index] = tuple(round(c * level) for c in color)
    return colors


def frame_reports(colors):
    groups = {}
    for index, rgb in colors.items():
        groups.setdefault(rgb, []).append(index)
    # 任意逐键配色也不得越过单事务 18 个报告的安全上限。
    transactions, batch, size = [], [], 0
    for rgb, indices in groups.items():
        cost = 4 + len(indices)
        if size + cost > rk.MAX_REPORTS * rk.NATIVE_PAYLOAD:
            transactions.append(rk.packetize(rk.groups_to_stream(batch)))
            batch, size = [], 0
        batch.append((rgb, indices))
        size += cost
    if batch:
        transactions.append(rk.packetize(rk.groups_to_stream(batch)))
    return transactions


class Controller:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.settings = copy.deepcopy(DEFAULT)
        self.controlled = False
        self.connected = False
        self.sending = False
        self.message = "正在查找接收器"
        self.presets = []
        self.device = None
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text())
                self.settings = validate(data["settings"])
                self.presets = [{"id": p["id"], "name": p["name"], "settings": validate(p["settings"])}
                                for p in data.get("presets", [])]
                self.controlled = data.get("controlled") is True
            except (ValueError, KeyError, TypeError):
                self.message = "本地配置无法读取，已使用默认设置"
        self.thread = threading.Thread(target=self.run, daemon=True)

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"settings": self.settings, "controlled": self.controlled,
                                         "presets": self.presets}, ensure_ascii=False), encoding="utf-8")
        temporary.replace(self.path)

    def snapshot(self):
        return {"settings": self.settings, "controlled": self.controlled,
                "connected": self.connected, "sending": self.sending,
                "message": self.message, "presets": self.presets}

    def request(self, request):
        with self.lock:
            action = request["action"]
            if action == "apply":
                settings = validate(request["settings"])
                previous = self.settings, self.controlled
                self.settings, self.controlled = settings, True
                try:
                    self.save()
                except OSError:
                    self.settings, self.controlled = previous
                    raise
            elif action == "release":
                previous = self.controlled
                self.controlled = False
                try:
                    self.save()
                except OSError:
                    self.controlled = previous
                    raise
                self.close_device()
                self.message = "已交还键盘自带灯效"
            elif action == "savePreset":
                name = request.get("name", "").strip()
                if not 1 <= len(name) <= 24:
                    raise ValueError("预设名称须为 1 到 24 个字")
                preset = {"id": uuid.uuid4().hex, "name": name, "settings": validate(request["settings"])}
                self.presets.append(preset)
                try:
                    self.save()
                except OSError:
                    self.presets.pop()
                    raise
            elif action == "deletePreset":
                previous = self.presets
                self.presets = [p for p in self.presets if p["id"] != request["id"]]
                try:
                    self.save()
                except OSError:
                    self.presets = previous
                    raise
            elif action != "snapshot":
                raise ValueError("未知操作")
            return copy.deepcopy(self.snapshot())

    def close_device(self):
        if self.device:
            try:
                self.device.close()
            except OSError:
                pass
            self.device = None
        self.sending = False

    def run(self):
        started = time.monotonic()
        while not self.stop.is_set():
            with self.lock:
                try:
                    if not self.controlled:
                        self.close_device()
                        self.connected = any(d.get("usage_page") == rk.USAGE_PAGE
                                             for d in rk.hid.enumerate(rk.VID, rk.PID))
                        self.message = "接收器已连接 · 使用键盘自带灯效" if self.connected else "未找到接收器，请检查 2.4G 连接"
                    else:
                        if self.device is None:
                            self.device = rk.open_dev()
                        reports = frame_reports(frame_colors(self.settings, time.monotonic() - started))
                        for transaction in reports:
                            for report in transaction:
                                if self.device.write(list(report)) != rk.REPORT_SIZE:
                                    raise OSError("写入不完整")
                                time.sleep(rk.GAP_MS / 1000)
                        self.connected = self.sending = True
                        self.message = "灯光已关闭" if not self.settings["power"] else "正在持续同步灯光"
                except (OSError, StopIteration) as exc:
                    self.close_device()
                    self.connected = False
                    self.message = ("接收器访问失败：%s。请允许光序的输入监控权限；重新构建后需移除旧授权并重新添加。" % exc
                                    if isinstance(exc, OSError) else "未找到接收器，正在等待重新连接")
            self.stop.wait(0.2 if self.controlled and self.sending else 1)
        with self.lock:
            self.close_device()


def main():
    controller = Controller(sys.argv[1])
    controller.thread.start()
    try:
        for line in sys.stdin:
            try:
                result = {"data": controller.request(json.loads(line))}
            except (ValueError, KeyError, TypeError, OSError) as exc:
                result = {"error": str(exc)}
            print(json.dumps(result, ensure_ascii=False), flush=True)
    finally:
        controller.stop.set()
        controller.thread.join(timeout=2)


if __name__ == "__main__":
    main()
