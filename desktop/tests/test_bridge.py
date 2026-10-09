import copy
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bridge


class FrameTests(unittest.TestCase):
    def test_all_right_hand_leds_are_included(self):
        colors = bridge.frame_colors(bridge.DEFAULT, 0)
        self.assertTrue(set(bridge.rk98.NUMPAD.values()) <= set(colors))
        self.assertIn(112, colors)

    def test_power_brightness_and_override(self):
        settings = copy.deepcopy(bridge.DEFAULT)
        settings.update(brightness=50, overrides={"0": "#ff0000"})
        self.assertEqual(bridge.frame_colors(settings, 0)[0], (128, 0, 0))
        settings["power"] = False
        self.assertEqual(set(bridge.frame_colors(settings, 0).values()), {(0, 0, 0)})

    def test_effects_change_with_time(self):
        for mode in ("breathe", "wave"):
            settings = {**bridge.DEFAULT, "mode": mode}
            self.assertNotEqual(bridge.frame_colors(settings, 0), bridge.frame_colors(settings, 1))

    def test_transactions_have_valid_checksums_and_preserve_every_color(self):
        colors = {i: (i, 255 - i, (i * 2) % 256) for i in bridge.INDICES}
        decoded = {}
        transactions = bridge.frame_reports(colors)
        self.assertGreater(len(transactions), 1)
        for reports in transactions:
            self.assertLessEqual(len(reports), bridge.rk98.MAX_REPORTS)
            stream = bytearray()
            for seq, report in enumerate(reports):
                self.assertEqual(len(report), bridge.rk98.REPORT_SIZE)
                self.assertEqual(report[:4], bytes((0x13, 0x88, len(reports), seq)))
                self.assertEqual(report[19], sum(report[:19]) & 255)
                stream.extend(report[5:5 + report[4] - 0x10])
            while stream:
                g, r, b, n = stream[:4]
                for index in stream[4:4 + n]:
                    decoded[index] = (r, g, b)
                del stream[:4 + n]
        self.assertEqual(decoded, colors)

    def test_invalid_input_never_reaches_hardware(self):
        for changes in ({"color": "red"}, {"brightness": -1}, {"speed": 101},
                        {"mode": "bad"}, {"power": 1}, {"overrides": {"255": "#ff0000"}}):
            with self.assertRaises(ValueError):
                bridge.validate({**bridge.DEFAULT, **changes})


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "lighting.json"
        self.controller = bridge.Controller(self.path)

    def tearDown(self):
        self.controller.stop.set()
        if self.controller.thread.is_alive():
            self.controller.thread.join(2)
        self.temp.cleanup()

    def test_first_launch_does_not_take_over_lighting(self):
        self.assertFalse(self.controller.controlled)
        self.assertFalse(self.path.exists())

    def test_settings_presets_and_release_survive_restart(self):
        c = self.controller
        settings = {**bridge.DEFAULT, "brightness": 42, "overrides": {"112": "#aabbcc"}}
        c.request({"action": "apply", "settings": settings})
        result = c.request({"action": "savePreset", "name": "测试配色", "settings": settings})
        preset = result["presets"][0]
        restored = bridge.Controller(self.path)
        self.assertEqual(restored.settings, settings)
        self.assertEqual(restored.presets[0]["name"], "测试配色")
        self.assertTrue(restored.controlled)
        c.request({"action": "release"})
        c.request({"action": "deletePreset", "id": preset["id"]})
        restored = bridge.Controller(self.path)
        self.assertFalse(restored.controlled)
        self.assertEqual(restored.presets, [])

    def test_save_error_rolls_back_state(self):
        with patch.object(self.controller, 'save', side_effect=OSError('写入失败')):
            with self.assertRaises(OSError):
                self.controller.request({"action": "apply", "settings": {**bridge.DEFAULT, "brightness": 10}})
        self.assertFalse(self.controller.controlled)
        self.assertEqual(self.controller.settings, bridge.DEFAULT)

    def test_invalid_settings_are_not_persisted(self):
        with self.assertRaises(ValueError):
            self.controller.request({"action": "apply", "settings": {**bridge.DEFAULT, "brightness": 999}})
        self.assertFalse(self.path.exists())

    def test_unplug_reconnect_and_release(self):
        class Device:
            count = 0
            closed = False
            def write(self, report):
                self.count += 1
                return len(report)
            def close(self):
                self.closed = True
        device = Device()
        attempts = []
        def open_device():
            attempts.append(1)
            if len(attempts) == 1:
                raise OSError('设备已断开')
            return device
        self.controller.request({"action": "apply", "settings": bridge.DEFAULT})
        with patch.object(bridge.rk98, 'open_dev', side_effect=open_device), patch.object(bridge.rk98, 'device_present', return_value=False):
            self.controller.thread.start()
            deadline = time.monotonic() + 3
            while not self.controller.sending and time.monotonic() < deadline:
                time.sleep(.02)
            self.assertTrue(self.controller.sending)
            self.assertGreaterEqual(len(attempts), 2)
            self.controller.request({"action": "release"})
            count = device.count
            time.sleep(.3)
            self.assertEqual(device.count, count)
            self.assertTrue(device.closed)
            self.controller.stop.set()
            self.controller.thread.join(2)

    def test_closed_input_stops_the_process(self):
        import subprocess
        result = subprocess.run([sys.executable, str(Path(bridge.__file__)), str(self.path)],
                                input='{"action":"snapshot"}\n', text=True, capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(result.stdout)["data"]["controlled"])


if __name__ == '__main__':
    unittest.main()
