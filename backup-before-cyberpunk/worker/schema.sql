-- ============================================
-- 秋末留言板 - D1 数据库建表 SQL
-- ============================================

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER DEFAULT NULL,
    nickname    TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    token       TEXT    NOT NULL,
    ip_address  TEXT    DEFAULT NULL,
    likes       INTEGER DEFAULT 0,
    is_deleted  INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
);

-- 顶层评论按时间倒序
CREATE INDEX IF NOT EXISTS idx_comments_created
    ON comments(created_at DESC) WHERE parent_id IS NULL AND is_deleted = 0;

-- 回复按父评论分组
CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON comments(parent_id) WHERE is_deleted = 0;

-- 点赞表
CREATE TABLE IF NOT EXISTS likes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id  INTEGER NOT NULL,
    client_id   TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    UNIQUE(comment_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_comment
    ON likes(comment_id);

-- 限流表
CREATE TABLE IF NOT EXISTS rate_limits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address  TEXT    NOT NULL,
    action      TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_ip_action
    ON rate_limits(ip_address, action, created_at);
