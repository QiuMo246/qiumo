-- ============================================
-- 秋末留言板 - Supabase PostgreSQL 建表 SQL
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================

-- 启用 UUID 扩展（Supabase 默认已启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 评论表
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
    id          BIGSERIAL PRIMARY KEY,
    parent_id   BIGINT      DEFAULT NULL REFERENCES comments(id) ON DELETE SET NULL,
    nickname    TEXT        NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 20),
    content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    token       TEXT        NOT NULL,
    ip_address  TEXT        DEFAULT NULL,
    likes       INTEGER     DEFAULT 0 CHECK (likes >= 0),
    is_deleted  BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 顶层评论按时间倒序
CREATE INDEX IF NOT EXISTS idx_comments_top_latest
    ON comments(created_at DESC)
    WHERE parent_id IS NULL AND is_deleted = FALSE;

-- 顶层评论按热度排序
CREATE INDEX IF NOT EXISTS idx_comments_top_popular
    ON comments(likes DESC, id DESC)
    WHERE parent_id IS NULL AND is_deleted = FALSE;

-- 回复按父评论分组
CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON comments(parent_id, created_at ASC)
    WHERE is_deleted = FALSE;

-- ============================================
-- 点赞表
-- ============================================
CREATE TABLE IF NOT EXISTS likes (
    id          BIGSERIAL PRIMARY KEY,
    comment_id  BIGINT      NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    client_id   TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_comment
    ON likes(comment_id);

-- ============================================
-- 博客文章表
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    content     TEXT        NOT NULL,
    excerpt     TEXT        DEFAULT '',
    cover_image TEXT        DEFAULT '',
    published   BOOLEAN     DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published, created_at DESC);

-- ============================================
-- 授权：service_role 需要有完整权限
-- 后端 API 使用 service_role key 访问 Supabase
-- ============================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 确保未来新建的表也自动授权
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- ============================================
-- Row Level Security（RLS）策略
-- 前端直连 Supabase 时需要 RLS
-- ============================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes    ENABLE ROW LEVEL SECURITY;

-- 允许任何人读取未删除的评论
CREATE POLICY "comments_select" ON comments
    FOR SELECT USING (is_deleted = FALSE);

-- 允许任何人插入评论（anon key 访问）
CREATE POLICY "comments_insert" ON comments
    FOR INSERT WITH CHECK (TRUE);

-- 只允许持有正确 token 的人软删除（通过前端逻辑，不在 DB 层强制）
-- 注意：token 校验在前端 JS 中完成，DB 层允许 update（带条件）
CREATE POLICY "comments_update_soft_delete" ON comments
    FOR UPDATE USING (TRUE);

-- 点赞表：任何人可读、可插入、可删除自己的记录
CREATE POLICY "likes_select" ON likes
    FOR SELECT USING (TRUE);

CREATE POLICY "likes_insert" ON likes
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "likes_delete" ON likes
    FOR DELETE USING (TRUE);

-- ============================================
-- 实用函数：原子性 toggle_like
-- 使用数据库函数避免前端多次请求
-- ============================================
CREATE OR REPLACE FUNCTION toggle_like(
    p_comment_id BIGINT,
    p_client_id  TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_liked   BOOLEAN;
    v_likes   INTEGER;
BEGIN
    -- 检查评论是否存在且未删除
    IF NOT EXISTS (
        SELECT 1 FROM comments
        WHERE id = p_comment_id AND is_deleted = FALSE
    ) THEN
        RAISE EXCEPTION 'comment_not_found';
    END IF;

    -- 判断是否已点赞
    IF EXISTS (
        SELECT 1 FROM likes
        WHERE comment_id = p_comment_id AND client_id = p_client_id
    ) THEN
        -- 取消点赞
        DELETE FROM likes
        WHERE comment_id = p_comment_id AND client_id = p_client_id;

        UPDATE comments
        SET likes = GREATEST(0, likes - 1)
        WHERE id = p_comment_id;

        v_liked := FALSE;
    ELSE
        -- 添加点赞
        INSERT INTO likes (comment_id, client_id)
        VALUES (p_comment_id, p_client_id)
        ON CONFLICT (comment_id, client_id) DO NOTHING;

        UPDATE comments
        SET likes = likes + 1
        WHERE id = p_comment_id;

        v_liked := TRUE;
    END IF;

    -- 返回最新点赞数
    SELECT likes INTO v_likes FROM comments WHERE id = p_comment_id;

    RETURN json_build_object('liked', v_liked, 'likes', v_likes);
END;
$$;

-- ============================================
-- 使用示例（可选，测试用）
-- ============================================
-- ============================================
-- AI 聊天每日限额表
-- ============================================
CREATE TABLE IF NOT EXISTS chat_limits (
    id          BIGSERIAL PRIMARY KEY,
    client_ip   TEXT NOT NULL,
    chat_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    count       INTEGER DEFAULT 0,
    UNIQUE(client_ip, chat_date)
);

CREATE INDEX IF NOT EXISTS idx_chat_limits_lookup
    ON chat_limits(client_ip, chat_date);

GRANT ALL ON chat_limits TO service_role;
GRANT ALL ON SEQUENCE chat_limits_id_seq TO service_role;

-- SELECT toggle_like(1, 'test-client-id');
-- SELECT * FROM comments WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT 10;
