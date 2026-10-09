"""RK R98 三模键盘 2.4G 灯光控制。

对外导出协议常量、编解码函数与设备操作，供命令行入口（python -m rk98）
和 desktop/bridge.py 共用。
"""

from .device import device_present, open_dev, pump
from .protocol import (COLORS, GAP_MS, KEYMAP, LED_COUNT, MAX_REPORTS,
                       NATIVE_PAYLOAD, NUMPAD, PID, REPORT_SIZE, USAGE_PAGE,
                       VID, groups_to_stream, packetize, parse_color)

__all__ = [
    "COLORS", "GAP_MS", "KEYMAP", "LED_COUNT", "MAX_REPORTS", "NATIVE_PAYLOAD",
    "NUMPAD", "PID", "REPORT_SIZE", "USAGE_PAGE", "VID",
    "device_present", "groups_to_stream", "open_dev", "packetize", "parse_color", "pump",
]
