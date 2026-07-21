# 秋末个人网站

秋末的个人开发者网站 — 前端开发、独立产品、UI 设计。

## 项目结构

```
├── index.html                 # 主页面
├── styles.css                 # 全局样式
├── script.js                  # 主脚本（粒子动画、打字机、导航、滚动动画等）
├── package.json               # 前端依赖（GSAP）
├── project-config.json        # Cloudflare Pages 部署配置
├── deploy.bat                 # 一键部署脚本
│
├── guestbook/                 # 留言板模块
│   ├── guestbook.js           # 评论系统主逻辑
│   ├── guestbook.css          # 评论系统样式
│   ├── markdown.js            # 轻量 Markdown 解析器
│   └── emoji-picker.js        # Emoji 选择器
│
├── blog/                      # 博客模块
│   ├── blog.js                # 博客展示逻辑
│   └── blog.css               # 博客样式
│
├── admin/                     # 后台管理模块
│   ├── admin.js               # 管理控制台（评论管理、文章发布）
│   └── admin.css              # 管理后台样式
│
├── components/                # 可复用组件
│   └── music-player/          # 音乐播放器组件
│       ├── music-player.js
│       └── music-player.css
│
├── assets/                    # 静态资源
│   └── music/                 # 音乐文件
│
├── worker/                    # Cloudflare Worker 后端（留言板评论 API）
│   ├── wrangler.toml          # Worker 配置
│   ├── package.json           # 后端依赖
│   ├── schema.sql             # D1 数据库建表 SQL
│   ├── README.md              # Worker API 文档和部署指南
│   └── src/
│       ├── index.js           # Worker 入口和路由
│       ├── db.js              # D1 数据库查询
│       └── middleware.js      # CORS、限流、安全
│
├── functions/                 # Cloudflare Pages Functions 后端
│   └── api/
│       ├── auth.js            # 管理员登录认证
│       ├── posts.js           # 博客文章 API
│       └── admin/             # 管理后台 API
│           ├── comments.js    # 评论管理
│           └── posts.js       # 文章管理
│
├── api/                       # Node.js API（本地开发/备用）
│   ├── _supabase.js           # Supabase REST 辅助模块
│   ├── auth.js                # 管理员认证
│   ├── posts.js               # 博客文章查询
│   ├── envcheck.js            # 环境变量检查
│   └── admin/                 # 管理 API
│       ├── comments.js
│       └── posts.js
│
└── supabase_schema.sql        # Supabase PostgreSQL 建表 SQL
```

## 功能特性

### 首页
- 粒子动画背景（Canvas）
- 打字机效果（交替角色标题）
- 渐变光晕装饰
- 滚动进入动画（reveal）
- 响应式导航栏 + 移动端菜单

### 留言板
- 游客发表评论（昵称 + 内容）
- 回复评论（单层嵌套）
- 点赞 / 取消点赞
- 删除自己的评论（基于 Token）
- 最新排序 / 热门排序
- 游标分页（加载更多）
- Markdown 语法支持
- Emoji 表情选择器
- 图片上传接口（预留）

### 博客
- Markdown 文章展示
- 文章列表页 + 详情页
- 从 Supabase 数据库动态加载
- 文章 slugs 路由
- 发布 / 下架控制

### 后台管理
- 管理员登录认证
- 评论管理（删除）
- 博客文章发布、编辑、删除

### 音乐播放器
- 内置 15 首音乐
- 播放 / 暂停 / 切歌
- 音量控制
- 歌曲列表展示

### 安全
- XSS 防护（服务端转义 + 客户端安全渲染）
- SQL 注入防护（参数化查询）
- IP 限流（评论 3次/分，删除 5次/分，点赞 10次/分）
- 防重复提交（5秒去重）
- 管理员密码认证

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript，GSAP 动画 |
| 后端 API | Cloudflare Pages Functions + Cloudflare Workers |
| 数据库 | Supabase (PostgreSQL) + Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages + Cloudflare Workers |
| 组件 | 自定义音乐播放器 |

## 快速开始

### 本地预览

直接用浏览器打开 `index.html` 即可预览。

### 一键部署

运行 `deploy.bat`，自动执行：
1. Git 提交并推送（触发 Cloudflare Pages 自动部署）
2. 部署 Cloudflare Worker（`worker/` 目录）

## 环境变量

Cloudflare Pages 需配置以下环境变量：

| 变量 | 说明 |
|------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role 密钥 |
| `ADMIN_SECRET` | 管理员登录密码 |

## 自定义配置

### 修改作者昵称

在两个地方同步修改：

1. `worker/wrangler.toml` → `AUTHOR_NAME = "秋末"`
2. `guestbook/guestbook.js` → `const authorName = '秋末'`

### 敏感词过滤

编辑 `worker/src/middleware.js`，在 `FILTER_WORDS` 数组中添加关键词：

```javascript
const FILTER_WORDS = ['广告', '垃圾', 'spam'];
```

### 添加音乐

将音乐文件放入 `assets/music/` 目录，并在 `components/music-player/music-player.js` 中注册。

## 浏览器兼容性

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

使用了 `crypto.randomUUID()`、`fetch`、`IntersectionObserver` 等现代 API。

## License

MIT
