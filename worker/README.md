# 秋末留言板 - Worker 后端 API 文档

## 概述

基于 Cloudflare Workers + D1 的评论系统后端 API。

**Base URL:** `https://<your-worker>.workers.dev`

所有响应均为 JSON 格式，Content-Type: `application/json; charset=utf-8`。

---

## API 端点

### 1. 获取评论列表

**GET** `/api/comments`

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sort | string | 否 | 排序方式：`latest`（默认）/ `popular`（按点赞数） |
| cursor | string | 否 | 游标分页，传入上一页最后一条的 `created_at` |
| limit | number | 否 | 每页数量，默认 10，最大 20 |
| parent_id | number | 否 | 传入则返回该评论的全部回复 |

**响应 (200)：**
```json
{
    "comments": [
        {
            "id": 12,
            "nickname": "访客",
            "content": "支持 Markdown 的 **内容**",
            "likes": 3,
            "created_at": "2026-04-28T10:30:00Z",
            "replies": [
                {
                    "id": 15,
                    "nickname": "秋末",
                    "content": "谢谢！",
                    "likes": 0,
                    "created_at": "2026-04-28T11:00:00Z"
                }
            ],
            "reply_count": 2
        }
    ],
    "next_cursor": "2026-04-28T08:00:00Z",
    "has_more": true,
    "total": 42
}
```

---

### 2. 发表评论

**POST** `/api/comments`

**请求体：**
```json
{
    "nickname": "访客",
    "content": "留言内容（支持 **Markdown**）",
    "parent_id": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 是 | 昵称，最长 20 字符 |
| content | string | 是 | 内容，最长 1000 字符，支持 Markdown |
| parent_id | number | 否 | 父评论 ID，不传则为顶层评论 |

**响应 (201)：**
```json
{
    "id": 13,
    "token": "a1b2c3d4e5f6...",
    "nickname": "访客",
    "content": "留言内容",
    "created_at": "2026-04-28T10:35:00Z"
}
```

> ⚠️ **重要：** `token` 仅在创建时返回一次，请务必保存到 localStorage，用于后续删除评论。

**错误响应：**
- `400` - 参数错误（昵称/内容为空或超长）
- `429` - 评论过于频繁（限 3 次/分钟/IP）

---

### 3. 删除评论

**DELETE** `/api/comments/:id`

**请求体：**
```json
{
    "token": "创建评论时返回的 token"
}
```

**响应 (200)：**
```json
{
    "success": true
}
```

**错误响应：**
- `403` - Token 无效
- `404` - 评论不存在
- `429` - 操作过于频繁（限 5 次/分钟/IP）

---

### 4. 点赞 / 取消点赞

**POST** `/api/comments/:id/like`

**请求体：**
```json
{
    "client_id": "浏览器生成的 UUID"
}
```

**响应 (200)：**
```json
{
    "liked": true,
    "likes": 4
}
```

> 同一 `client_id` 对同一评论只能点赞一次，再次请求会取消点赞。

**错误响应：**
- `400` - 缺少 client_id
- `404` - 评论不存在
- `429` - 操作过于频繁（限 10 次/分钟/IP）

---

### 5. 图片上传（预留）

**POST** `/api/upload`

**响应 (501)：**
```json
{
    "error": "图片上传功能即将上线"
}
```

---

## 部署指南

### 1. 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare 账号](https://dash.cloudflare.com/)
- 已安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 2. 创建 D1 数据库

```bash
cd worker
npx wrangler d1 create qiumo-comments
```

将输出的 `database_id` 填入 `wrangler.toml`。

### 3. 初始化数据库表

```bash
# 线上数据库
npx wrangler d1 execute qiumo-comments --remote --file=schema.sql

# 本地开发数据库
npx wrangler d1 execute qiumo-comments --local --file=schema.sql
```

### 4. 配置环境变量

编辑 `wrangler.toml`，填入：

```toml
[vars]
CORS_ORIGIN = "https://your-domain.com"  # 你的网站域名
ADMIN_SECRET = "your-random-secret"       # 随机管理密钥
AUTHOR_NAME = "秋末"                       # 作者昵称
```

### 5. 本地开发

```bash
npm install
npm run dev
```

Worker 默认运行在 `http://localhost:8787`。

### 6. 部署

```bash
npm run deploy
```

部署后将 Worker URL 填入前端 `guestbook/guestbook.js` 的 `API_BASE` 常量。

---

## 安全机制

| 机制 | 说明 |
|------|------|
| IP 限流 | POST 3次/分, DELETE 5次/分, LIKE 10次/分 |
| XSS 防护 | 服务端 HTML 转义 + 客户端 Markdown 安全渲染 |
| SQL 注入 | 所有查询使用参数化语句 |
| 防重复提交 | 5 秒内相同 IP + 相同内容会被拒绝 |
| Token 删除 | 256bit 随机 Token，常量时间比较 |
| CORS | 仅允许配置的域名访问 |
| 敏感词过滤 | 接口预留，可在 `middleware.js` 中配置 `FILTER_WORDS` |
