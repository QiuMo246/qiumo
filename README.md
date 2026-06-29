# 秋末个人网站

秋末的个人开发者网站 — 前端开发、独立产品、UI 设计。

## 项目结构

```
├── index.html              # 主页面
├── styles.css              # 全局样式
├── script.js               # 主脚本（粒子、打字机、导航、模态框等）
├── guestbook/              # 留言板前端模块
│   ├── guestbook.js        # 评论系统主逻辑
│   ├── guestbook.css       # 评论系统样式
│   ├── markdown.js         # 轻量 Markdown 解析器
│   └── emoji-picker.js     # Emoji 选择器
└── worker/                 # Cloudflare Worker 后端
    ├── wrangler.toml       # Worker 配置
    ├── package.json        # 后端依赖
    ├── schema.sql          # D1 数据库建表 SQL
    ├── README.md           # API 文档和部署指南
    └── src/
        ├── index.js        # Worker 入口和路由
        ├── db.js           # D1 数据库查询
        └── middleware.js   # CORS、限流、安全
```

## 功能特性

### 留言板

- ✅ 游客发表评论（昵称 + 内容）
- ✅ 回复评论（单层嵌套）
- ✅ 点赞 / 取消点赞
- ✅ 删除自己的评论（基于 Token）
- ✅ 最新排序 / 热门排序
- ✅ 游标分页（加载更多）
- ✅ Markdown 语法支持
- ✅ Emoji 表情选择器
- ✅ 图片上传接口（预留）

### 安全

- ✅ XSS 防护（服务端转义 + 客户端安全渲染）
- ✅ SQL 注入防护（参数化查询）
- ✅ IP 限流（评论 3次/分，删除 5次/分，点赞 10次/分）
- ✅ 防重复提交（5秒去重）
- ✅ 敏感词过滤接口（预留）
- ✅ 管理后台接口（预留）

### UI

- ✅ 卡片式评论界面
- ✅ 与网站风格一致的深色主题
- ✅ 提交动画（加载 → 成功）
- ✅ Skeleton Loading 骨架屏
- ✅ Toast 消息提示
- ✅ Emoji 选择器
- ✅ Markdown 实时预览
- ✅ 移动端响应式适配
- ✅ `prefers-reduced-motion` 无障碍支持

## 快速开始

### 前端（静态站点）

直接用浏览器打开 `index.html` 即可预览。

### 后端（Cloudflare Worker）

```bash
# 1. 进入 worker 目录
cd worker

# 2. 安装依赖
npm install

# 3. 创建 D1 数据库
npx wrangler d1 create qiumo-comments
# 将返回的 database_id 填入 wrangler.toml

# 4. 初始化数据库表
npx wrangler d1 execute qiumo-comments --remote --file=schema.sql

# 5. 配置 wrangler.toml
#    - CORS_ORIGIN: 你的网站域名
#    - ADMIN_SECRET: 随机管理密钥
#    - AUTHOR_NAME: 作者昵称

# 6. 本地开发
npm run dev

# 7. 部署
npm run deploy
```

### 连接前后端

部署 Worker 后，将 Worker URL 填入 `guestbook/guestbook.js` 文件顶部的 `API_BASE` 常量：

```javascript
const API_BASE = 'https://qiumo-comments.your-subdomain.workers.dev';
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript（无框架） |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare 边缘网络 |

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

### 图片上传

当需要启用图片上传时：

1. 在 Cloudflare 创建 R2 存储桶
2. 在 `wrangler.toml` 中添加 R2 绑定
3. 实现 `worker/src/index.js` 中的 `/api/upload` 路由
4. 在前端 `guestbook.js` 中激活图片上传 UI

## 浏览器兼容性

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

使用了 `crypto.randomUUID()`、`fetch`、`IntersectionObserver` 等现代 API。

## License

MIT
