# Bead Pattern Editor

面向像素珠子图的 Web 编辑器项目。第一阶段先用浏览器完成图片转换、网格编辑、颜色替换、撤销重做和 PNG 导出；后续如果需要 App 化，再把稳定的核心逻辑迁移到 React Native。

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS v4
- 原生 Canvas / DOM 作为第一阶段 Web 渲染层
- ESLint + Prettier 做基础代码约束
- Vercel 作为推荐部署目标

## 本地启动

```bash
npm install
npm run dev
```

默认本地访问地址：

```txt
http://localhost:5333/
```

常用命令：

```bash
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## 目录结构

```txt
src/
  app/               # 页面级入口，后续可接路由
  components/        # 通用 UI 组件
  features/editor/   # 编辑器业务组合层
  core/              # 平台无关的算法、状态和数据模型
    color/           # 色板、颜色转换、最近颜色
    history/         # 撤销、重做和操作栈
    image/           # 图片转像素图算法
    pattern/         # 网格、珠子图、导入导出数据结构
  platform/web/      # Web 专属画布、指针事件、文件下载适配
  styles/            # 全局样式和设计变量
```

## 架构原则

核心逻辑不要写死在 React 组件里。图片量化、颜色匹配、网格数据、撤销重做、导出结构都应该放进 `src/core/`，这样未来迁移 React Native 时可以复用。

Web 端相关能力放在 `src/platform/web/`，例如 Canvas 绘制、浏览器文件上传、PNG 下载、触摸事件兼容等。

## 第一阶段路线图

1. 建立编辑器状态：网格尺寸、当前工具、当前颜色、缩放、历史栈。
2. 迁移 HTML 原型里已验证的工具：拖拽、画笔、橡皮、填充、吸管、颜色替换。
3. 实现图片转换：保留 RGBQuant 无抖动和 Atkinson 两条主路线。
4. 完成移动浏览器适配：触摸绘制、缩放区域、底部面板、导出体验。
5. 接入项目保存：本地 JSON、导入导出、未来可扩展云端保存。

## 后续 RN 迁移策略

先把 Web 产品跑通，再逐步评估 RN。可迁移的部分包括：

- `src/core/color`
- `src/core/image`
- `src/core/pattern`
- `src/core/history`

需要重写或适配的部分主要是：

- Web Canvas 渲染层
- 文件上传和下载
- 鼠标、触摸、手势交互
- 移动端原生导出和分享能力

如果后续进入 RN，推荐用 Expo 起步，再按需要引入 `react-native-skia`。
