# 光序 · 键盘灯光工作室

基于 [MyGo](https://github.com/egoist/mygo) 的个人 macOS 灯光控制应用，适配本项目的 **RK R98 / 2.4G 接收器**。没有账号、网络服务、遥测或分发流程。桌面端与命令行共用 `rk98/` 里的同一套协议实现。

## 直接打开

已经为这台 Apple 芯片的电脑构建好应用：

```sh
open desktop/build/darwin-arm64/光序.app
```

也可以在访达中双击，或将应用拖到程序坞。应用使用本机虚拟环境里的 Python，不是独立分发包：**请保留当前项目和 `.venv`**。移动项目后，重新构建即可更新路径。

## 首次设备授权

macOS 可能要求「输入监控」权限来打开键盘接收器。若出现「接收器访问失败」，点击应用中的「打开输入监控」，在「系统设置 → 隐私与安全性 → 输入监控」中允许「光序」，然后退出并重新打开应用。

**本应用采用本地临时签名，重新构建会改变签名。** 如果开关已经打开却仍然报错，请先移除列表中的旧「光序」，再通过加号添加 `desktop/build/darwin-arm64/光序.app`，允许后重新打开。无需给应用完全磁盘访问权限，也无需改动系统权限数据库。

## 使用

- **首次启动不接管灯光**；点击「开启灯光」、选择预设或修改设置后开始控制。
- 支持常亮、呼吸、双色流光；颜色、亮度和速度修改后自动同步。
- 点击键帽可多选，再选择颜色；支持主键区、数字键区快捷选择。
- 单键配色覆盖灯效基础色。选择「整个键盘」后更换颜色会清除单键配色；亮度始终作用于整个键盘。
- 自定义预设保存于本机，可以重新应用或删除。
- 「关闭灯光」持续发送黑色；「恢复键盘自带灯效」停止发送，让键盘自行接管。
- 关闭窗口后继续运行；点击程序坞图标重新显示，按 `⌘Q` 完全退出并释放设备。下次启动恢复上次设置及接管状态。
- 接收器断开后等待重新连接，不需要重启程序。

接收器连接状态不等于无线键盘已经唤醒。由于现有协议无法可靠读取电量和灯光实际颜色，界面不虚构电量、设备反馈或板载保存结果。

### 已知映射范围

可视化键盘包含 98 个按键。索引沿用 `rk98/protocol.py` 的 `KEYMAP`、`NUMPAD`：右侧高位索引（包括 `102`～`112` 中已有映射的灯）也参与全键控制。`keymap_r98.json` 记录数字锁定键仍存疑，主键区部分键位也尚未逐点确认；界面仅展示现有映射，不能替代实物逐键校验。

请勿同时运行 `python -m rk98 --stay`、`tools/sweep.py` 等其他会写入灯光的脚本，以免互相覆盖。

## 命令行控制

协议与设备操作都在 `rk98/` 包内：`protocol.py` 只做编解码，`device.py` 负责设备连接与灯光帧重发，`__main__.py` 是命令行入口。桌面端通过 `desktop/bridge.py` 复用同一套实现，两边不会各写一份协议。

```sh
.venv/bin/python -m rk98 fill red            # 全键盘红色
.venv/bin/python -m rk98 set esc blue        # 单键，键名见 rk98/protocol.py
.venv/bin/python -m rk98 set 12 00ff00       # 按索引
.venv/bin/python -m rk98 off                 # 全灭
.venv/bin/python -m rk98 fill red --stay     # 持续到 Ctrl+C；默认发 10 秒后停
```

需要检查设备或标定键位时用 `tools/` 下的脚本：`probe.py` 枚举 HID 接口、`scan.py` 扫 Feature Report、`monitor.py` 轮询状态变化、`send.py` 读写 Feature / Output Report、`sweep.py` 逐点标定 LED 索引。`keymap_r98.json` 是 `sweep.py` 的标定原始记录，键位表以 `rk98/protocol.py` 为准。

## 开发与构建

环境：Go 1.27.1 或更新版本、Node.js 22.12 或更新版本、项目现有的 `.venv`。Go 会按 `go.mod` 自动下载匹配的工具链。只有安装依赖、构建时可能需要联网，应用运行不联网。

```sh
# 仅在需要重建 Python 环境时执行
python3 -m venv .venv
.venv/bin/python -m pip install hidapi==0.15.0

cd desktop
npm ci
npm run dev             # 原生窗口 + 前端热更新
npm run build           # 构建本机应用，仅临时签名，不生成磁盘映像、不公证
```

只预览界面：

```sh
cd desktop
npm run dev:web
```

浏览器预览会明确提示「不连接键盘」，不会模拟硬件成功，也不能保存原生应用的预设。

## 测试

```sh
cd desktop
npx playwright install chromium webkit
npm test
```

测试覆盖协议校验和、报告数量上限、完整灯珠索引、任意单键配色拆包、参数验证、配置持久化、进程退出、模拟断开重连与释放，以及两个浏览器内核下的交互和最小窗口布局。自动化界面测试使用模拟控制桥，不会更改真实键盘灯光。

## 实现与本地文件

```text
rk98/                   # 键盘协议与设备控制（命令行与桌面端共用）
├── protocol.py         # 常量、键位表、GRB 字节序与报告编解码
├── device.py           # 设备连接、在线检测与灯光帧重发
└── __main__.py         # 命令行入口：python -m rk98
tools/                  # 逆向与调试脚本
├── probe.py            # 枚举 HID 接口
├── scan.py             # 扫描 Feature Report
├── monitor.py          # 轮询状态变化
├── send.py             # 读写 Feature / Output Report
└── sweep.py            # 逐点标定 LED 索引
desktop/
├── main.go             # MyGo 窗口、菜单、单实例、类型化进程通信
├── bridge.py           # 本地控制、灯效、配置、设备重连
├── src/                # 界面、键盘布局和生成的通信绑定
├── resources/          # 图标与构建时生成的本机 Python 路径
├── tests/              # 协议与界面测试
└── build/darwin-arm64/光序.app
keymap_r98.json         # sweep.py 的标定原始记录
```

- 配置和预设：`~/Library/Application Support/光序/lighting.json`。
- 控制桥复用 `rk98` 的打包逻辑，保持每报告至少 7 毫秒间隔、每事务最多 18 个报告，帧之间至少 200 毫秒；多色超限时拆成多个安全事务。
- 灯效运行在电脑上，不写固件或板载配置。更多逐键颜色会需要更多报告，因此实际刷新速度会降低；屏幕预览不要求和硬件逐帧锁相。
- 图标由本地矢量资源生成；前端资源内嵌在应用中，运行时没有开发服务器或额外网络端口。
