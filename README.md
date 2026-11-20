# 今日页

一个基于 Vue 2 + Element UI 的本地待办记录工具。界面采用“日账”结构：左侧按时间排列当天未完成事项，右侧显示本周完成节奏与接下来要处理的事项。

## 打开方式

直接双击 `index.html` 可以浏览页面；PWA 安装和离线缓存需要通过 HTTP/HTTPS 访问。请在当前目录启动静态服务：

```powershell
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 已实现

- 快速添加待办，支持 `Enter` 提交
- 使用 Element UI 日期选择器设置截止日期
- 今天 / 本周 / 全部 / 已完成四个视图
- 搜索、完成勾选、实时进度
- 编辑标题、备注、日期、时间、分类和优先级
- 删除单条待办、清除全部已完成记录
- 浏览器 `localStorage` 本地持久化
- 1440 / 768 / 390 三种宽度适配

## 数据

示例数据已清空。新增待办只保存在当前浏览器的 `localStorage` 中，不会上传到服务器。

## 技术说明

- Vue `2.7.16` + Element UI `2.15.14`
- Vue、Element UI 及其样式均已放在 `assets` 目录下
- 页面样式在 `assets/tododay.css`
- 页面逻辑在 `assets/tododay.js`
- `assets/data.js` 仅提供空任务列表，用户数据使用独立的 `localStorage` key 保存










## 安装为 PWA

- Chrome / Edge：访问页面后，点击地址栏右侧的“安装”按钮
- Android Chrome：通过浏览器菜单选择“添加到主屏幕”或“安装应用”
- iOS Safari：通过分享菜单选择“添加到主屏幕”
- 首次在线打开后，应用外壳会被 Service Worker 缓存，之后可离线启动

PWA 文件：

- `manifest.webmanifest`：应用名称、启动模式、主题色和图标
- `sw.js`：离线缓存与更新策略
- `assets/icons/`：安装图标与 Apple Touch Icon

部署新版本并修改前端资源后，需要同步修改 `sw.js` 中的 `CACHE_NAME`，以清理旧缓存。
