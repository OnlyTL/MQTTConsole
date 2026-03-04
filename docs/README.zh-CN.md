# MQTT Console（中文文档）

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-enabled-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
[![English Docs](https://img.shields.io/badge/Docs-English-0F172A)](../README.md)
[![中文文档](https://img.shields.io/badge/文档-中文-16A34A)](./README.zh-CN.md)

一个基于 React + Vite 的 MQTT Web 控制台。  
支持连接配置管理、主题订阅、消息查看与发布、本地持久化、可选 GitHub 加密同步，以及 PWA 安装。

## 目录

1. [项目简介](#项目简介)
2. [功能特性](#功能特性)
3. [页面截图](#页面截图)
4. [技术栈](#技术栈)
5. [快速开始](#快速开始)
6. [脚本说明](#脚本说明)
7. [部署到 Vercel](#部署到-vercel)
8. [配置说明](#配置说明)
9. [GitHub 同步（详细步骤）](#github-同步详细步骤)
10. [目录结构](#目录结构)
11. [常见问题](#常见问题)

## 项目简介

MQTT Console 面向 MQTT 调试与测试场景：

- 管理多个 Broker 连接配置
- 订阅/取消订阅主题并设置 QoS
- 快速发布消息
- 文本/JSON 双视图查看消息
- 本地存储配置与历史数据
- 可选 GitHub Gist 加密同步
- 可安装为 PWA

## 功能特性

- `连接配置`: 保存 broker 地址、client ID、认证信息、心跳、超时、重连参数
- `主题管理`: 主题分组、启停订阅、编辑与删除
- `消息中心`: 支持方向/主题/载荷筛选，虚拟列表，展开/复制/详情查看
- `消息发布`: 支持 Topic、Payload、QoS、Retain
- `加密同步（可选）`: 通过 GitHub Gist 同步，使用口令加密
- `多语言`: 内置中英文切换
- `主题`: 支持亮色/暗色模式
- `PWA`: 支持安装和离线静态资源缓存

## 页面截图

当前为占位图，请将真实截图放到 `docs/screenshots/` 后替换。

### 桌面端主页（占位）

![桌面端主页](./screenshots/desktop-main-placeholder.svg)

### 移动端视图（占位）

![移动端视图](./screenshots/mobile-view-placeholder.svg)

### 同步设置（占位）

![同步设置](./screenshots/sync-settings-placeholder.svg)

## 技术栈

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS v4
- shadcn/ui + radix-ui
- mqtt.js
- @tanstack/react-virtual
- vite-plugin-pwa

## 快速开始

### 环境要求

- 推荐 Node.js 20+
- 推荐 npm 10+

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

然后访问 Vite 输出的地址（通常是 `http://localhost:5173`）。

### 构建生产包

```bash
npm run build
```

### 本地预览生产包

```bash
npm run preview
```

## 脚本说明

- `npm run dev`: 启动开发服务器
- `npm run build`: 类型检查 + 生产构建
- `npm run preview`: 本地预览构建产物
- `npm run lint`: 执行 ESLint

## 部署到 Vercel

项目已可直接部署到 Vercel。  
仓库中已包含最小配置文件：[`vercel.json`](../vercel.json)。

### Fork 后快速部署

1. 在 GitHub Fork 本仓库
2. 打开 Vercel：`https://vercel.com/new`
3. 导入你自己的 fork 仓库
4. 使用默认构建参数（Framework: `Vite`，Build: `npm run build`，Output: `dist`）
5. 点击 `Deploy`

### 推荐配置

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js Version: `20.x`（推荐）

### 环境变量

- 必填：无
- 可选：无（GitHub 同步通过页面配置，不依赖服务端环境变量）

### 自动部署

完成仓库绑定后：

- 向目标分支（例如 `main`）push 代码
- Vercel 会自动重新构建并发布

## 配置说明

### Broker 地址

请使用 WebSocket 协议地址：

- `ws://...`
- `wss://...`

### 本地存储

浏览器本地会保存：

- 连接配置
- 主题配置
- 消息记录
- UI 偏好
- 同步设置

## GitHub 同步（详细步骤）

如果你希望在多设备之间同步数据，请按下面步骤操作：

1. 创建 GitHub 个人访问令牌（PAT，classic）：
   - 打开：`https://github.com/settings/tokens/new`
   - 勾选权限：`gist`
   - 创建后立即复制保存（只显示一次）
   - 参考文档：`https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens`
2. 创建 Secret Gist（或让应用自动创建）：
   - 打开：`https://gist.github.com/`
   - 新建一个 **Secret** Gist，文件名可自定义（例如 `mqtt-console.sync.v1.json`）
   - 从 URL 提取 Gist ID：`https://gist.github.com/<user>/<gist_id>`
   - 如果不填 Gist ID，应用会在首次 `Push` 时自动创建并写回
   - 参考文档：`https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists`
3. 在 MQTT Console 中填写同步配置：
   - 打开 `Sync` 对话框
   - 开启 `Enable Sync`
   - `GitHub Token`：填 PAT
   - `Gist ID`：填已有 ID，或留空自动创建
   - `Encryption Passphrase`：填写加密口令（所有设备必须一致）
   - 可选：开启 `Auto Sync` 和 `Sync Messages`
4. 首次推荐流程：
   - 设备 A（已有数据）：点击 `Push`
   - 设备 B（新设备）：填入相同 Token + Gist ID + 口令后点击 `Pull`
5. 日常使用：
   - `Pull`：拉取远端最新数据
   - `Push`：上传本地变更
   - `Sync Now`：一次执行拉取 + 上传

安全建议：

- 不要把 Token 和口令写入代码仓库
- 一旦泄露，请立即吊销并重建 Token
- 如果口令更换，旧数据无法用新口令解密

## 目录结构

```text
src/
  components/                 # 通用 UI 组件
  features/mqtt-console/      # 业务页面与面板
  hooks/                      # 自定义 hooks
  i18n/                       # 国际化配置
  lib/                        # 工具函数
  types/                      # 类型定义
public/                       # 静态资源（图标、PWA 文件等）
docs/                         # 文档和截图
```

## 常见问题

- `PWA 不更新`: 强制刷新并清理站点数据/Service Worker 缓存
- `连接失败`: 确认 Broker 开启 WebSocket MQTT，并检查地址和协议
- `同步失败`: 检查 Token（`gist` 权限）、Gist ID、口令是否正确

