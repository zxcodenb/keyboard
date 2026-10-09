# 光序 · 键盘灯光工作室

本地运行的桌面键盘灯光应用。通用控制、灯效计算、键盘档案和硬件协议分层组织，不以具体品牌或型号命名项目。

**目前只有一个已实现的适配器**：标识为 `3554:fa09` 的接收器，配套现有键盘档案。协议参考 [Lightning-13/rk-m75](https://github.com/Lightning-13/rk-m75)，保留本项目的实测映射与安全发送参数。目录和接口已为后续适配器、用户工作空间留出边界，但尚未实现账号登录、键盘切换界面或多设备同时控制。

## 目录结构

```text
go.mod                         # 全项目统一的原生后端模块
cmd/desktop/                   # 桌面程序入口、窗口、菜单与依赖组装
internal/
├── app/                       # 控制器、接管状态、预设和配置持久化
├── lighting/                  # 通用设置校验与灯效计算
├── keyboard/                  # 键盘档案、颜色帧、适配器接口
├── adapters/receiver/         # 当前接收器协议与底层设备访问
└── desktop/                   # 桌面框架绑定、系统权限入口
profiles/                      # 后端与界面共用的键盘档案
apps/desktop/
├── frontend/                  # 界面入口、样式与生成的接口绑定
├── resources/                 # 应用图标
├── tests/                     # 界面测试
├── mygo.json                  # 桌面框架配置
├── package.json               # 开发、构建与测试命令
└── build/                     # 构建产物，不入库
tools/legacy/                  # 保留的旧脚本与迁移对照，不参与桌面打包
├── receiver/                  # 原协议、设备控制和命令行包
├── bridge.py                  # 旧版控制桥
├── fixtures/                  # 原始键位标定记录
└── tests/                     # 旧版脚本测试
docs/architecture.md           # 依赖方向、用户隔离与新键盘接入说明
```

具体型号名称只作为档案中的设备信息保留，不进入通用控制器或灯效算法。界面从活动档案读取键帽布局、设备名称、连接说明和选区；浏览器预览使用示例档案，不模拟设备连接成功。

## 开发与构建

环境：Go 1.27.1 或更新版本、Node.js 22.12 或更新版本，以及苹果命令行开发工具。设备通信库随程序编译，无需脚本解释器、虚拟环境或额外设备通信动态库。

```sh
# 仅在尚未安装苹果命令行开发工具时执行
xcode-select --install

cd apps/desktop
npm ci
npm run dev
npm run build
```

在仓库根目录也可执行：

```sh
npm --prefix apps/desktop run build
```

桌面框架的开发、构建和绑定生成命令已开启 `CGO_ENABLED=1`。运行不联网，没有账号服务或遥测。构建目前面向本机苹果芯片平台，使用临时签名，不生成磁盘映像、不公证。

```sh
# 在仓库根目录打开已构建应用
open apps/desktop/build/darwin-arm64/光序.app
```

仅预览界面：

```sh
cd apps/desktop
npm run dev:web
```

## 使用与设备授权

- 首次启动不接管灯光；开启灯光、选择预设或修改设置后开始控制。
- 支持常亮、呼吸、双色流光，以及覆盖基础灯效的单键配色。
- 选择「整个键盘」后更换颜色会清除单键配色；亮度作用于整个键盘。
- 「关闭灯光」持续发送黑色；「恢复键盘自带灯效」停止发送。
- 关闭窗口后继续运行，点击程序坞图标重新打开；按 `⌘Q` 完全退出。
- 下次启动恢复上次设置与接管状态；设备断开后等待重新连接。

苹果系统可能要求输入监控权限。出现「设备访问失败」时，可点击「打开输入监控」，在系统设置中允许「光序」，然后重启应用。重新构建会改变临时签名；若已有授权仍然失败，请移除旧授权，重新添加新路径下的应用。无需授予完全磁盘访问权限。

设备连接状态不代表无线键盘已唤醒，也不代表灯光写入已由键盘确认。当前适配器不提供可靠的电量、实际灯光颜色或板载保存反馈，界面不会虚构这些信息。

## 用户与配置

配置保存在系统当前用户的应用数据目录内，再按用户工作空间和键盘档案隔离：

```text
~/Library/Application Support/光序/
└── users/
    └── local/
        └── keyboards/
            └── receiver-3554-fa09/
                └── lighting.json
```

- `local` 是当前默认的本地工作空间，不代表已实现账号体系。
- 键盘目录使用稳定档案标识，不用显示名称或品牌简称。
- 设置、接管状态和自定义预设一起保存在对应档案目录中。
- 当前按键盘档案隔离，不区分同型号的多个实物设备；后续接入设备选择时需加入稳定的设备实例标识。
- 原有根目录下的 `lighting.json` 仅作为默认工作空间、默认键盘的兼容来源。新文件不存在时读取旧配置，下一次保存写入新路径；不删除旧文件，不覆盖已有的新配置，也不向其他键盘复用旧配置。

## 当前适配器约束

- 每份报告二十字节，载荷最多十四字节；每事务最多十八份报告。
- 报告间隔至少七毫秒，帧间隔至少二百毫秒；超限配色拆成多个安全事务。
- 颜色按绿、红、蓝顺序编码；退出时在事务边界停发。
- 灯效在电脑端持续发送，不改键盘固件或板载配置。
- 档案保留九十八键布局与现有高位灯珠索引。主键区部分映射和数字锁定键仍待实物核对，目录重构不等于完成新的硬件验证。

请勿同时运行桌面应用和其他会写入同一键盘灯光的程序。

## 测试状态

本轮按要求先重构，**仅做编译、前端构建及应用打包检查，未运行自动化测试或实机测试**。已有测试随目录和接口调整，完整协议、持久化、用户隔离和设备重连回归仍待补齐与执行。

后续测试命令：

```sh
cd apps/desktop
npx playwright install chromium webkit
npm test
```

界面测试使用模拟接口，不写入真实设备。

## 旧版调试工具

`tools/legacy/` 仅供逆向、标定和迁移对照；桌面应用不会调用或打包这些脚本。原 `rk98` 包已移至此目录并改名为 `receiver`，原始标定文件也已归档。

在仓库根目录执行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install hidapi==0.15.0

PYTHONPATH=tools/legacy .venv/bin/python -m receiver fill red
PYTHONPATH=tools/legacy .venv/bin/python -m receiver set esc blue
PYTHONPATH=tools/legacy .venv/bin/python -m receiver off
.venv/bin/python tools/legacy/probe.py
.venv/bin/python tools/legacy/sweep.py
```

目录中的 `scan.py`、`monitor.py`、`send.py` 继续提供原有扫描、状态监控与报告读写能力。逐点标定结果写入 `tools/legacy/fixtures/receiver-3554-fa09-keymap.json`，它是原始记录，不会自动覆盖正式档案。

旧脚本测试不能作为新后端的验证结果：

```sh
.venv/bin/python -m unittest discover -s tools/legacy/tests -v
```
