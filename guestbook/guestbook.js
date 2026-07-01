// ============================================
// 留言板主模块 - Supabase 版
// 替换原 Cloudflare Worker + D1 方案
// ============================================

;(function () {
    'use strict';

    // ============================================
    // ---- 配置：填入你的 Supabase 项目信息 ----
    // ============================================
    const SUPABASE_URL  = 'https://gtockqpvcnwvkpkhqvdv.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0b2NrcXB2Y253dmtwa2hxdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4OTI0NzUsImV4cCI6MjA5ODQ2ODQ3NX0.kHAyPMpXAGmvpF4a3Cik-OL2O069ieOR0oiraZGXKSU';    

    // ============================================
    // ---- 常量 ----
    // ============================================
    const PAGE_SIZE       = 10;
    const CLIENT_ID_KEY   = 'gb_client_id';
    const TOKEN_PREFIX    = 'gb_token_';
    const NICKNAME_KEY    = 'gb_nickname';
    const PENDING_KEY     = 'gb_pending_comments';
    const CACHE_KEY       = 'gb_cache_comments';
    const CACHE_TTL_MS    = 60 * 1000;    // 评论列表缓存 60s（弱网友好）

    const TIMEOUT_MS      = 12000;        // 请求超时 12s
    const MAX_RETRIES     = 3;
    const RETRY_BASE_DELAY = 800;

    // ============================================
    // ---- 工具函数 ----
    // ============================================
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function timeAgo(dateStr) {
        const now  = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60)      return '刚刚';
        if (diff < 3600)    return Math.floor(diff / 60)    + ' 分钟前';
        if (diff < 86400)   return Math.floor(diff / 3600)  + ' 小时前';
        if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getOrCreateClientId() {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id) {
            id = crypto.randomUUID
                ? crypto.randomUUID()
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
            localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
    }

    function generateToken() {
        const arr = new Uint8Array(24);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }

    function storeToken(commentId, token) {
        localStorage.setItem(TOKEN_PREFIX + commentId, token);
    }
    function getToken(commentId) {
        return localStorage.getItem(TOKEN_PREFIX + commentId);
    }
    function removeToken(commentId) {
        localStorage.removeItem(TOKEN_PREFIX + commentId);
    }
    function isOwnComment(comment) {
        if (localStorage.getItem('admin_token')) return true; // 管理员可以看到所有评论的删除按钮
        return !!getToken(comment.id);
    }

    // ============================================
    // ---- Supabase REST 封装（无需 SDK） ----
    // 直接使用原生 fetch，减少依赖、兼容性更好
    // ============================================
    const SB = {
        headers() {
            return {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON,
                'Authorization': `Bearer ${SUPABASE_ANON}`,
                'Prefer':        'return=representation',
            };
        },

        // GET /rest/v1/{table}?select=...&filters
        async select(table, params = {}) {
            const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
            const res = await fetchWithTimeout(url.toString(), {
                method: 'GET',
                headers: this.headers(),
            });
            if (!res.ok) throw new Error(`DB read error: ${res.status}`);
            return res.json();
        },

        // POST /rest/v1/{table}
        async insert(table, data) {
            const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}`, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error || '插入失败');
            return Array.isArray(json) ? json[0] : json;
        },

        // PATCH /rest/v1/{table}?filter
        async update(table, filter, data) {
            const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
            Object.entries(filter).forEach(([k, v]) => url.searchParams.set(k, v));
            const res = await fetchWithTimeout(url.toString(), {
                method: 'PATCH',
                headers: this.headers(),
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(json.message || '更新失败');
            }
            return res.json();
        },

        // DELETE /rest/v1/{table}?filter
        async delete(table, filter) {
            const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
            Object.entries(filter).forEach(([k, v]) => url.searchParams.set(k, v));
            const res = await fetchWithTimeout(url.toString(), {
                method: 'DELETE',
                headers: {
                    ...this.headers(),
                    'Prefer': 'return=minimal',
                },
            });
            if (!res.ok) throw new Error('删除失败');
        },

        // 调用 Supabase 数据库函数（RPC）
        async rpc(fnName, params = {}) {
            const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(params),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.hint || 'RPC 调用失败');
            return json;
        },
    };

    // ============================================
    // ---- 带超时的 fetch ----
    // ============================================
    function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timer));
    }

    // ---- 自动重试 + 指数退避 ----
    async function retryFetch(fn, retries = MAX_RETRIES, delay = RETRY_BASE_DELAY) {
        let lastErr;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastErr = err;
                if (attempt >= retries) break;
                const isNetworkErr = err.name === 'AbortError'
                    || err.message === 'Failed to fetch'
                    || !navigator.onLine;
                if (!isNetworkErr) throw err;
                const wait = delay * Math.pow(2, attempt);
                console.warn(`[guestbook] 第 ${attempt + 1} 次重试, ${wait}ms 后...`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
        throw lastErr;
    }

    // ============================================
    // ---- 本地评论列表缓存（应对弱网） ----
    // ============================================
    const Cache = {
        get(sort) {
            try {
                const raw = sessionStorage.getItem(CACHE_KEY + '_' + sort);
                if (!raw) return null;
                const { ts, data } = JSON.parse(raw);
                if (Date.now() - ts > CACHE_TTL_MS) return null;
                return data;
            } catch { return null; }
        },
        set(sort, data) {
            try {
                sessionStorage.setItem(CACHE_KEY + '_' + sort, JSON.stringify({
                    ts: Date.now(),
                    data,
                }));
            } catch {}
        },
        clear(sort) {
            try { sessionStorage.removeItem(CACHE_KEY + '_' + sort); } catch {}
        },
    };

    // ============================================
    // ---- 离线队列 ----
    // ============================================
    function getPendingComments() {
        try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; }
        catch { return []; }
    }
    function savePendingComments(list) {
        localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    }
    function addPendingComment(comment) {
        const list = getPendingComments();
        list.push({ ...comment, _queuedAt: Date.now() });
        savePendingComments(list);
    }
    function removePendingComment(index) {
        const list = getPendingComments();
        list.splice(index, 1);
        savePendingComments(list);
    }

    async function syncPendingComments() {
        const pending = getPendingComments();
        if (pending.length === 0) return;
        showToast(`正在同步 ${pending.length} 条待发送的评论...`, 'info');

        for (let i = pending.length - 1; i >= 0; i--) {
            const item = pending[i];
            try {
                const result = await API.createComment(item.nickname, item.content, item.parentId || null);
                removePendingComment(i);
                Cache.clear(Guestbook.state.sort);

                if (Guestbook && Guestbook.listEl) {
                    const newComment = {
                        id: result.id,
                        nickname: result.nickname,
                        content: result.content,
                        likes: 0,
                        created_at: result.created_at,
                        replies: [],
                        reply_count: 0,
                    };
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = renderComment(newComment);
                    const card = tempDiv.firstElementChild;
                    if (card) {
                        card.classList.add('gb-new');
                        Guestbook.listEl.prepend(card);
                    }
                }
            } catch (err) {
                console.warn('[guestbook] 同步失败，保留待发送:', item.content.slice(0, 20));
            }
        }

        if (getPendingComments().length === 0) {
            showToast('全部评论已同步成功', 'success');
        }
    }

    // ============================================
    // ---- 网络状态监听 ----
    // ============================================
    let isOnline = navigator.onLine;

    function initNetworkListeners() {
        window.addEventListener('online', () => {
            isOnline = true;
            console.log('[guestbook] 网络已恢复');
            syncPendingComments();
        });
        window.addEventListener('offline', () => {
            isOnline = false;
            showToast('网络已断开，评论将暂存至本地，恢复后自动提交', 'info');
        });
    }

    // ============================================
    // ---- 错误消息 ----
    // ============================================
    function getErrorMessage(err, fallback = '操作失败') {
        if (err.name === 'AbortError') return '请求超时，请检查网络后重试';
        if (err.message === 'Failed to fetch' || !navigator.onLine) {
            return '网络连接异常，评论已暂存至本地，恢复后自动提交';
        }
        return err.message || fallback;
    }

    // ============================================
    // ---- Toast ----
    // ============================================
    function showToast(message, type = 'info') {
        const container = $('#toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.position = 'relative';
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `
            <span class="toast-icon ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}">${icon}</span>
            <span class="toast-text">${escapeHtml(message)}</span>
            <div class="toast-progress"></div>
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ============================================
    // ---- API 层（基于 Supabase REST） ----
    // ============================================
    const API = {

        /**
         * 获取评论列表（分页）
         * 使用 Supabase PostgREST Range 分页
         */
        async getComments(sort, page = 0) {
            const from = page * PAGE_SIZE;
            const to   = from + PAGE_SIZE - 1;

            // 查询顶层评论
            const orderParam = sort === 'popular'
                ? 'likes.desc,id.desc'
                : 'created_at.desc';

            const comments = await retryFetch(() =>
                SB.select('comments', {
                    select:      'id,parent_id,nickname,content,likes,created_at',
                    is_deleted:  'eq.false',
                    parent_id:   'is.null',
                    order:       orderParam,
                    offset:      from,
                    limit:       PAGE_SIZE + 1,   // 多取 1 条判断 has_more
                })
            );

            const hasMore   = comments.length > PAGE_SIZE;
            const pageItems = comments.slice(0, PAGE_SIZE);
            const ids       = pageItems.map(c => c.id);

            // 批量获取回复（最多 3 条 per 父评论）
            let repliesMap    = {};
            let replyCountMap = {};

            if (ids.length > 0) {
                const allReplies = await retryFetch(() =>
                    SB.select('comments', {
                        select:     'id,parent_id,nickname,content,likes,created_at',
                        is_deleted: 'eq.false',
                        parent_id:  `in.(${ids.join(',')})`,
                        order:      'created_at.asc',
                    })
                );

                for (const reply of allReplies) {
                    const pid = reply.parent_id;
                    replyCountMap[pid] = (replyCountMap[pid] || 0) + 1;
                    if (!repliesMap[pid]) repliesMap[pid] = [];
                    if (repliesMap[pid].length < 3) {
                        repliesMap[pid].push(reply);
                    }
                }
            }

            // 获取总数（使用 HEAD 请求 + Content-Range）
            const total = await this._getTotal();

            return {
                comments: pageItems.map(c => ({
                    ...c,
                    replies:     repliesMap[c.id]    || [],
                    reply_count: replyCountMap[c.id] || 0,
                })),
                has_more: hasMore,
                total,
                next_page: hasMore ? page + 1 : null,
            };
        },

        // 获取总条数（只请求 header，不传输数据体）
        async _getTotal() {
            try {
                const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/comments?select=id&is_deleted=eq.false&parent_id=is.null`, {
                    method: 'HEAD',
                    headers: {
                        ...SB.headers(),
                        'Prefer': 'count=exact',
                    },
                });
                const range = res.headers.get('Content-Range');
                if (range) {
                    const total = range.split('/')[1];
                    return total === '*' ? 0 : parseInt(total) || 0;
                }
            } catch {}
            return 0;
        },

        // 获取某条评论的全部回复
        async getReplies(parentId) {
            const replies = await retryFetch(() =>
                SB.select('comments', {
                    select:     'id,parent_id,nickname,content,likes,created_at',
                    is_deleted: 'eq.false',
                    parent_id:  `eq.${parentId}`,
                    order:      'created_at.asc',
                })
            );
            return { replies };
        },

        // 发表评论
        async createComment(nickname, content, parentId = null) {
            const token = generateToken();

            // 验证父评论（若有）：只支持一级嵌套
            if (parentId) {
                const parents = await retryFetch(() =>
                    SB.select('comments', {
                        select:     'id,parent_id',
                        id:         `eq.${parentId}`,
                        is_deleted: 'eq.false',
                    })
                );
                if (!parents.length) throw new Error('父评论不存在');
                if (parents[0].parent_id !== null) throw new Error('只支持一级回复');
            }

            const row = await retryFetch(() =>
                SB.insert('comments', {
                    nickname:   nickname.trim().slice(0, 20),
                    content:    content.trim().slice(0, 1000),
                    token,
                    parent_id:  parentId || null,
                    ip_address: null,     // 纯前端无法拿到真实 IP
                })
            );

            return {
                id:         row.id,
                token,
                nickname:   row.nickname,
                content:    row.content,
                created_at: row.created_at,
            };
        },

        // 删除评论（软删除，需要 token 验证）
        async deleteComment(id, token) {
            // 如果已登录管理员，调用后台删除接口
            const adminToken = localStorage.getItem('admin_token');
            if (adminToken) {
                const res = await fetch(`/api/admin/comments?id=${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                });
                if (!res.ok) throw new Error('管理员删除失败');
                return { success: true };
            }

            // 普通用户使用自己的 token 校验删除
            const rows = await retryFetch(() =>
                SB.select('comments', {
                    select: 'token',
                    id:     `eq.${id}`,
                })
            );
            if (!rows.length) throw new Error('评论不存在');

            // 恒定时间 token 比较
            const storedToken = rows[0].token;
            if (!timingSafeEqual(token, storedToken)) {
                throw new Error('凭证无效，无法删除');
            }

            await retryFetch(() =>
                SB.update('comments', { id: `eq.${id}` }, { is_deleted: true })
            );
            return { success: true };
        },

        // 点赞 / 取消点赞（调用 DB 函数保证原子性）
        async toggleLike(id) {
            const clientId = getOrCreateClientId();
            const result = await retryFetch(() =>
                SB.rpc('toggle_like', {
                    p_comment_id: id,
                    p_client_id:  clientId,
                })
            );
            return result; // { liked: bool, likes: number }
        },
    };

    // ---- 恒定时间字符串比较（防时序攻击） ----
    function timingSafeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    }

    // ============================================
    // ---- Skeleton Loading ----
    // ============================================
    function renderSkeleton(count = 3) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="gb-card gb-skeleton-card">
                    <div class="gb-card-header">
                        <div class="gb-skeleton gb-skeleton-avatar"></div>
                        <div class="gb-card-meta">
                            <div class="gb-skeleton gb-skeleton-line" style="width:80px;height:14px"></div>
                            <div class="gb-skeleton gb-skeleton-line" style="width:60px;height:12px;margin-top:4px"></div>
                        </div>
                    </div>
                    <div class="gb-card-body">
                        <div class="gb-skeleton gb-skeleton-line" style="width:100%;height:14px"></div>
                        <div class="gb-skeleton gb-skeleton-line" style="width:75%;height:14px;margin-top:8px"></div>
                    </div>
                    <div class="gb-card-actions">
                        <div class="gb-skeleton gb-skeleton-line" style="width:50px;height:14px"></div>
                    </div>
                </div>`;
        }
        return html;
    }

    // ============================================
    // ---- 渲染评论 ----
    // ============================================
    function renderComment(comment, isReply = false) {
        const own        = isOwnComment(comment);
        const initial    = (comment.nickname || '?')[0];
        const authorName = '秋末';
        const isAuthor   = comment.nickname === authorName;
        const likedKey   = `gb_liked_${comment.id}`;
        const hasLiked   = localStorage.getItem(likedKey) === '1';

        const avatarBg = isAuthor ? 'background: var(--gradient-primary)' : '';

        let html = `
            <div class="gb-card ${isReply ? 'gb-reply-card' : ''}" data-id="${comment.id}">
                <div class="gb-card-header">
                    <div class="gb-avatar" style="${avatarBg}">
                        ${escapeHtml(initial)}
                    </div>
                    <div class="gb-card-meta">
                        <span class="gb-nickname">${escapeHtml(comment.nickname)}${isAuthor ? '<span class="gb-author-badge">作者</span>' : ''}</span>
                        <span class="gb-time">${timeAgo(comment.created_at)}</span>
                    </div>
                </div>
                <div class="gb-card-body">${Markdown.render(comment.content)}</div>
                <div class="gb-card-actions">
                    <button class="gb-action-btn gb-like-btn ${hasLiked ? 'liked' : ''}" data-id="${comment.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span class="gb-like-count">${comment.likes || 0}</span>
                    </button>
                    ${!isReply ? `<button class="gb-action-btn gb-reply-btn" data-id="${comment.id}" data-nickname="${escapeHtml(comment.nickname)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>回复</span>
                    </button>` : ''}
                    ${own ? `<button class="gb-action-btn gb-delete-btn" data-id="${comment.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        <span>删除</span>
                    </button>` : ''}
                </div>
                <div class="gb-replies" data-parent-id="${comment.id}">`;

        if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach(reply => {
                html += renderComment(reply, true);
            });
            if (comment.reply_count > 3) {
                html += `<button class="gb-show-more-replies" data-parent-id="${comment.id}">查看全部 ${comment.reply_count} 条回复</button>`;
            }
        }
        html += `</div></div>`;
        return html;
    }

    function renderEmpty() {
        return `
            <div class="gb-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>还没有留言，来做第一个留言的人吧</p>
            </div>`;
    }

    // ============================================
    // ---- 主控制器 ----
    // ============================================
    const Guestbook = {
        state: {
            sort:        'latest',
            page:        0,          // Supabase 用页码替代 cursor
            hasMore:     false,
            total:       0,
            isLoading:   false,
            submitting:  false,
            replyingTo:  null,
            pollTimer:   null,       // 轮询定时器
        },

        init() {
            this.listEl         = $('#gb-list');
            this.formEl         = $('#gb-form');
            this.submitBtn      = $('#gb-submit-btn');
            this.nicknameEl     = $('#gb-nickname');
            this.contentEl      = $('#gb-content');
            this.charCountEl    = $('#gb-char-count');
            this.loadMoreEl     = $('#gb-load-more');
            this.loadMoreBtn    = $('#gb-load-more-btn');
            this.countEl        = $('#gb-count');
            this.emojiBtn       = $('#gb-emoji-btn');
            this.previewBtn     = $('#gb-md-preview-btn');
            this.previewEl      = $('#gb-md-preview');
            this.previewContent = $('#gb-md-preview-content');
            this.emojiPickerEl  = $('#gb-emoji-picker');

            if (!this.listEl) return;

            initNetworkListeners();

            if (this.emojiPickerEl && this.contentEl) {
                window.EmojiPicker.init(this.contentEl, this.emojiPickerEl);
            }

            this.restoreNickname();
            this.bindEvents();
            this.loadComments(true);

            // 启动轮询（替代 WebSocket 实时更新）
            this.startPolling();
        },

        // ============================================
        // ---- 轮询（弱网友好，替代实时推送） ----
        // ============================================
        startPolling(intervalMs = 90000) {  // 每 90s 轮询一次
            this.stopPolling();
            this.state.pollTimer = setInterval(() => {
                // 页面可见时才轮询
                if (document.visibilityState === 'visible' && navigator.onLine) {
                    Cache.clear(this.state.sort);   // 清除缓存，拉取最新
                    this.silentRefresh();
                }
            }, intervalMs);
            // 页面重新变为可见时也触发
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.silentRefresh();
                }
            });
        },

        stopPolling() {
            if (this.state.pollTimer) {
                clearInterval(this.state.pollTimer);
                this.state.pollTimer = null;
            }
        },

        // 静默刷新：只更新计数，不重置列表
        async silentRefresh() {
            try {
                const total = await API._getTotal();
                if (total !== this.state.total) {
                    this.state.total = total;
                    this.countEl.textContent = `${total} 条留言`;
                }
            } catch {}
        },

        bindEvents() {
            this.formEl.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitComment();
            });

            this.contentEl.addEventListener('input', () => {
                this.charCountEl.textContent = this.contentEl.value.length;
            });

            $$('.gb-sort-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    $$('.gb-sort-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.sort = btn.dataset.sort;
                    this.loadComments(true);
                });
            });

            this.loadMoreBtn.addEventListener('click', () => {
                this.loadComments(false);
            });

            if (this.emojiBtn) {
                this.emojiBtn.addEventListener('click', () => {
                    window.EmojiPicker.toggle();
                });
            }

            if (this.previewBtn) {
                this.previewBtn.addEventListener('click', () => {
                    const visible = this.previewEl.style.display !== 'none';
                    if (visible) {
                        this.previewEl.style.display = 'none';
                        this.contentEl.style.display = '';
                    } else {
                        this.previewContent.innerHTML = Markdown.render(this.contentEl.value)
                            || '<p style="color:var(--text-muted)">在左侧输入内容即可预览</p>';
                        this.previewEl.style.display  = 'block';
                        this.contentEl.style.display  = 'none';
                    }
                });
            }

            this.listEl.addEventListener('click', (e) => {
                const likeBtn    = e.target.closest('.gb-like-btn');
                const replyBtn   = e.target.closest('.gb-reply-btn');
                const deleteBtn  = e.target.closest('.gb-delete-btn');
                const showMoreBtn = e.target.closest('.gb-show-more-replies');

                if (likeBtn)      this.toggleLike(likeBtn);
                else if (replyBtn)   this.startReply(replyBtn);
                else if (deleteBtn)  this.confirmDelete(deleteBtn);
                else if (showMoreBtn) this.loadAllReplies(showMoreBtn);
            });

            document.addEventListener('click', (e) => {
                if (this.emojiPickerEl
                    && !this.emojiPickerEl.contains(e.target)
                    && e.target !== this.emojiBtn) {
                    window.EmojiPicker.hide();
                }
            });
        },

        // ============================================
        // ---- 加载评论（带缓存回退） ----
        // ============================================
        async loadComments(reset) {
            if (this.state.isLoading) return;
            this.state.isLoading = true;

            if (reset) {
                this.state.page    = 0;
                this.state.hasMore = false;
                this.listEl.innerHTML = renderSkeleton();
                this.loadMoreEl.style.display = 'none';
            }

            try {
                // 先尝试从缓存读取（仅 reset 时）
                let data = null;
                if (reset) {
                    data = Cache.get(this.state.sort);
                }

                if (!data) {
                    data = await API.getComments(this.state.sort, this.state.page);
                    if (reset) Cache.set(this.state.sort, data);
                }

                this.state.total   = data.total;
                this.state.hasMore = data.has_more;

                if (reset) {
                    this.listEl.innerHTML = '';
                }

                if (data.comments.length === 0 && reset) {
                    this.listEl.innerHTML = renderEmpty();
                } else {
                    data.comments.forEach(c => {
                        this.listEl.insertAdjacentHTML('beforeend', renderComment(c));
                    });
                }

                this.countEl.textContent = `${this.state.total} 条留言`;
                this.loadMoreEl.style.display = this.state.hasMore ? '' : 'none';

            } catch (err) {
                console.error('[guestbook] 加载评论失败:', err);

                // 降级：尝试从缓存显示旧数据
                const cached = Cache.get(this.state.sort);
                if (cached && reset) {
                    this.listEl.innerHTML = '';
                    cached.comments.forEach(c => {
                        this.listEl.insertAdjacentHTML('beforeend', renderComment(c));
                    });
                    this.countEl.textContent = `${cached.total} 条留言（缓存）`;
                    showToast('网络异常，显示上次缓存的评论', 'info');
                } else if (reset) {
                    this.listEl.innerHTML = `
                        <div class="gb-empty">
                            <p>加载失败</p>
                            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
                                ${getErrorMessage(err, '请检查网络后刷新页面')}
                            </p>
                            <button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">
                                刷新页面
                            </button>
                        </div>`;
                }
                showToast(getErrorMessage(err, '加载评论失败'), 'error');
            } finally {
                this.state.isLoading = false;
            }
        },

        // ============================================
        // ---- 提交评论 ----
        // ============================================
        async submitComment() {
            if (this.state.submitting) return;

            const nickname = this.nicknameEl.value.trim();
            const content  = this.contentEl.value.trim();

            if (!nickname) { showToast('请输入昵称', 'error'); return; }
            if (!content)  { showToast('请输入评论内容', 'error'); return; }
            if (nickname.length > 20)   { showToast('昵称不超过 20 个字符', 'error'); return; }
            if (content.length  > 1000) { showToast('评论内容不超过 1000 个字符', 'error'); return; }

            this.state.submitting = true;
            this.submitBtn.classList.add('loading');
            this.submitBtn.disabled = true;

            try {
                const data = await API.createComment(
                    nickname,
                    content,
                    this.state.replyingTo?.id || null
                );
                storeToken(data.id, data.token);
                localStorage.setItem(NICKNAME_KEY, nickname);

                // 清空表单
                this.contentEl.value       = '';
                this.charCountEl.textContent = '0';
                this.cancelReply();

                // 清除缓存，下次加载获取最新
                Cache.clear(this.state.sort);

                // 构建并插入新评论卡片
                const newComment = {
                    id:          data.id,
                    nickname:    data.nickname,
                    content:     data.content,
                    likes:       0,
                    created_at:  data.created_at,
                    replies:     [],
                    reply_count: 0,
                };

                if (this.listEl.querySelector('.gb-empty')) {
                    this.listEl.innerHTML = '';
                }

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = renderComment(newComment);
                const card = tempDiv.firstElementChild;
                card.classList.add('gb-new');

                if (this.state.sort === 'latest') {
                    this.listEl.prepend(card);
                } else {
                    this.listEl.appendChild(card);
                }

                this.state.total++;
                this.countEl.textContent = `${this.state.total} 条留言`;
                showToast('留言发表成功', 'success');

                this.submitBtn.classList.remove('loading');
                this.submitBtn.classList.add('success');
                setTimeout(() => this.submitBtn.classList.remove('success'), 1500);

            } catch (err) {
                const isNetworkErr = err.name === 'AbortError'
                    || err.message === 'Failed to fetch'
                    || !navigator.onLine;

                if (isNetworkErr) {
                    addPendingComment({
                        nickname,
                        content,
                        parentId: this.state.replyingTo?.id || null,
                    });
                    showToast('评论已暂存至本地，网络恢复后自动提交', 'info');
                    this.contentEl.value       = '';
                    this.charCountEl.textContent = '0';
                    this.cancelReply();
                } else {
                    showToast(getErrorMessage(err, '提交失败'), 'error');
                }

                this.submitBtn.classList.remove('loading');
            } finally {
                this.state.submitting = false;
                this.submitBtn.disabled = false;
            }
        },

        // ---- 回复 ----
        startReply(btn) {
            const id       = parseInt(btn.dataset.id);
            const nickname = btn.dataset.nickname;
            this.state.replyingTo = { id, nickname };

            let indicator = $('.gb-reply-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'gb-reply-indicator';
                this.formEl.parentNode.insertBefore(indicator, this.formEl);
            }
            indicator.innerHTML = `
                <span>回复 <strong>${escapeHtml(nickname)}</strong></span>
                <button class="gb-reply-cancel" type="button">&times;</button>
            `;
            indicator.style.display = 'flex';
            indicator.querySelector('.gb-reply-cancel').addEventListener('click', () => this.cancelReply());

            this.formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => this.contentEl.focus(), 300);
        },

        cancelReply() {
            this.state.replyingTo = null;
            const indicator = $('.gb-reply-indicator');
            if (indicator) indicator.style.display = 'none';
        },

        // ---- 删除 ----
        confirmDelete(btn) {
            const id    = parseInt(btn.dataset.id);
            const token = getToken(id);
            if (!token) { showToast('无法验证身份', 'error'); return; }

            const overlay = document.createElement('div');
            overlay.className = 'gb-confirm-overlay';
            overlay.innerHTML = `
                <div class="gb-confirm-modal">
                    <h3>确认删除</h3>
                    <p>删除后无法恢复，确定要删除这条留言吗？</p>
                    <div class="gb-confirm-actions">
                        <button class="btn btn-ghost gb-confirm-cancel">取消</button>
                        <button class="btn btn-primary gb-confirm-ok">删除</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));

            overlay.querySelector('.gb-confirm-cancel').addEventListener('click', () => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);
            });

            overlay.querySelector('.gb-confirm-ok').addEventListener('click', async () => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 300);

                try {
                    await API.deleteComment(id, token);
                    removeToken(id);
                    Cache.clear(this.state.sort);

                    const card = $(`.gb-card[data-id="${id}"]`);
                    if (card) {
                        card.style.transition = 'all 0.4s ease';
                        card.style.opacity    = '0';
                        card.style.transform  = 'translateY(-10px) scale(0.98)';
                        setTimeout(() => card.remove(), 400);
                    }
                    this.state.total = Math.max(0, this.state.total - 1);
                    this.countEl.textContent = `${this.state.total} 条留言`;
                    showToast('留言已删除', 'success');
                } catch (err) {
                    showToast(getErrorMessage(err, '删除失败'), 'error');
                }
            });
        },

        // ---- 点赞（乐观更新） ----
        async toggleLike(btn) {
            const id           = parseInt(btn.dataset.id);
            const likedKey     = `gb_liked_${id}`;
            const wasLiked     = localStorage.getItem(likedKey) === '1';
            const countEl      = btn.querySelector('.gb-like-count');
            const svgEl        = btn.querySelector('svg');
            const currentCount = parseInt(countEl.textContent) || 0;

            const newLiked = !wasLiked;
            const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
            localStorage.setItem(likedKey, newLiked ? '1' : '0');
            btn.classList.toggle('liked', newLiked);
            svgEl.setAttribute('fill', newLiked ? 'currentColor' : 'none');
            countEl.textContent = newCount;

            try {
                const result = await API.toggleLike(id);
                countEl.textContent = result.likes;
                localStorage.setItem(likedKey, result.liked ? '1' : '0');
                btn.classList.toggle('liked', result.liked);
                svgEl.setAttribute('fill', result.liked ? 'currentColor' : 'none');
            } catch (err) {
                // 回滚
                localStorage.setItem(likedKey, wasLiked ? '1' : '0');
                btn.classList.toggle('liked', wasLiked);
                svgEl.setAttribute('fill', wasLiked ? 'currentColor' : 'none');
                countEl.textContent = currentCount;
                showToast('点赞失败，请重试', 'error');
            }
        },

        // ---- 加载全部回复 ----
        async loadAllReplies(btn) {
            const parentId = btn.dataset.parentId;
            btn.textContent = '加载中...';
            btn.disabled    = true;

            try {
                const data = await API.getReplies(parentId);
                const container = this.listEl.querySelector(`.gb-replies[data-parent-id="${parentId}"]`);
                if (!container) return;
                container.innerHTML = '';
                data.replies.forEach(reply => {
                    container.insertAdjacentHTML('beforeend', renderComment(reply, true));
                });
            } catch (err) {
                showToast(getErrorMessage(err, '加载回复失败'), 'error');
                btn.textContent = '重试';
                btn.disabled    = false;
            }
        },

        // ---- 昵称持久化 ----
        restoreNickname() {
            const saved = localStorage.getItem(NICKNAME_KEY);
            if (saved && this.nicknameEl) {
                this.nicknameEl.value = saved;
            }
        },

        // ---- 加载更多（翻页） ----
        loadMore() {
            if (!this.state.hasMore || this.state.isLoading) return;
            this.state.page++;
            this.loadComments(false);
        },
    };

    // ============================================
    // ---- 初始化 ----
    // ============================================
    function init() {
        Guestbook.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
