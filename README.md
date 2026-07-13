# 空气飞盘 Air Frisbee

用空中手势投掷虚拟飞盘：智能戒指瞄准倾角，智能手杖蓄力抛出。Capacitor 打包为手机 App，并适配手表小屏。

## 功能

- **场地**：草坪距离 / 穿环挑战 / 沙滩风场
- **物理**：蓄力抛掷 · 升力滑翔 · 倾角曲线 · 侧风偏移 · 落地计分
- **Web Audio**：蓄力嗡鸣、出手破风、落地 / 穿环音效
- **可穿戴输入**
  - 戒指：绝对倾角瞄准（左右偏航 · 上下仰角）· 甩动取消蓄力
  - 手杖：挥动蓄力 · 敲击出手
- **触控兜底**：拖动画布瞄准 · 蓄力 / 出手按钮
- **手表适配**：`max-width: 280px` 或 `max-height: 300px` 紧凑布局

## 项目结构

```
air-frisbee/
├── protocol/air-frisbee.json   # 手势与场地协议
└── mobile/
    ├── index.html
    ├── capacitor.config.json
    ├── package.json
    ├── scripts/build-web.js
    ├── src/
    │   ├── app.js              # UI 与手势路由
    │   ├── audio-engine.js     # 蓄力 / 出手 / 落地音
    │   ├── discs.js            # 飞盘款式与场地
    │   ├── physics.js          # 瞄准 / 蓄力 / 飞行
    │   └── wearable-input.js   # 戒指 / 手杖
    └── test/
```

## 快速开始

```bash
cd mobile
npm install
npm run build          # → www/
npm test
```

浏览器预览：

```bash
npx serve www
```

## 打包 Android / iOS

```bash
cd mobile
npm install
npx cap add android    # 或 ios
npm run mobile:android
# 或 npm run mobile:ios
```

日常：改 `src/` 或 `index.html` → `npm run build` → `npx cap sync android` → 真机运行。

## 手势对照

| 设备 | 动作 | 效果 |
|------|------|------|
| 戒指 | 倾角（绝对） | 瞄准偏航 / 仰角 |
| 戒指 | 甩动 > 20° | 取消蓄力 |
| 手杖 | 挥动 > 3 | 蓄力 |
| 手杖 | 加速度尖峰 > 8 | 出手 |

桌面调试：鼠标移动瞄准，按住空格蓄力、松开出手，`1`/`2`/`3` 换场地，`←`/`→` 换盘，`M` 静音，`R` 新一轮。
