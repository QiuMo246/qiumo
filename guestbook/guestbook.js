// ============================================
// 留言板主模块
// ============================================

;(function () {
    'use strict';

    // ---- 配置 ----
    const API_BASE = 'https://qiumo-comments.moqiu846.workers.dev';
    const PAGE_SIZE = 10;
    const CLIENT_ID_KEY = 'gb_client_id';
    const TOKEN_PREFIX = 'gb_token_';
    const NICKNAME_KEY = 'gb_nickname';

    // ---- 工具函数 ----
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
        if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getOrCreateClientId() {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id) {
            id = crypto.randomUUID ? crypto.randomUUID() :
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
            localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
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
        return !!getToken(comment.id);
    }

    // ---- Toast（复用 script.js 模式） ----
    function showToast(message, type = 'info') {
        const container = $('#toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.position = 'relative';
        const iconClass = type === 'success' ? 'success' : type === 'error' ? 'error' : '';
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `
            <span class="toast-icon ${iconClass}">${icon}</span>
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

    // ---- API 客户端 ----
    const API = {
        async getComments(sort, cursor) {
            let url = `${API_BASE}/api/comments?sort=${sort}&limit=${PAGE_SIZE}`;
            if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('加载失败');
            return res.json();
        },

        async getReplies(parentId) {
            const res = await fetch(`${API_BASE}/api/comments?parent_id=${parentId}`);
            if (!res.ok) throw new Error('加载回复失败');
            return res.json();
        },

        async createComment(nickname, content, parentId = null) {
            const res = await fetch(`${API_BASE}/api/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, content, parent_id: parentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '提交失败');
            return data;
        },

        async deleteComment(id, token) {
            const res = await fetch(`${API_BASE}/api/comments/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '删除失败');
            return data;
        },

        async toggleLike(id) {
            const clientId = getOrCreateClientId();
            const res = await fetch(`${API_BASE}/api/comments/${id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: clientId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '操作失败');
            return data;
        },
    };

    // ---- Skeleton Loading ----
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

    // ---- 渲染评论 ----
    function renderComment(comment, isReply = false) {
        const own = isOwnComment(comment);
        const initial = (comment.nickname || '?')[0];
        const authorName = '秋末'; // 与 wrangler.toml 中的 AUTHOR_NAME 一致
        const isAuthor = comment.nickname === authorName;
        const likedKey = `gb_liked_${comment.id}`;
        const hasLiked = localStorage.getItem(likedKey) === '1';

        const avatarBg = isAuthor
            ? 'background: var(--gradient-primary)'
            : '';

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
        // 回复区
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

    // ---- 主控制器 ----
    const Guestbook = {
        state: {
            sort: 'latest',
            cursor: null,
            hasMore: false,
            total: 0,
            isLoading: false,
            submitting: false,
            replyingTo: null, // { id, nickname }
        },

        init() {
            this.listEl = $('#gb-list');
            this.formEl = $('#gb-form');
            this.submitBtn = $('#gb-submit-btn');
            this.nicknameEl = $('#gb-nickname');
            this.contentEl = $('#gb-content');
            this.charCountEl = $('#gb-char-count');
            this.loadMoreEl = $('#gb-load-more');
            this.loadMoreBtn = $('#gb-load-more-btn');
            this.countEl = $('#gb-count');
            this.emojiBtn = $('#gb-emoji-btn');
            this.previewBtn = $('#gb-md-preview-btn');
            this.previewEl = $('#gb-md-preview');
            this.previewContent = $('#gb-md-preview-content');
            this.emojiPickerEl = $('#gb-emoji-picker');

            if (!this.listEl) return;

            // 初始化 Emoji Picker
            if (this.emojiPickerEl && this.contentEl) {
                window.EmojiPicker.init(this.contentEl, this.emojiPickerEl);
            }

            this.restoreNickname();
            this.bindEvents();
            this.loadComments(true);
        },

        bindEvents() {
            // 表单提交
            this.formEl.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitComment();
            });

            // 字数统计
            this.contentEl.addEventListener('input', () => {
                this.charCountEl.textContent = this.contentEl.value.length;
            });

            // 排序按钮
            $$('.gb-sort-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    $$('.gb-sort-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.sort = btn.dataset.sort;
                    this.loadComments(true);
                });
            });

            // 加载更多
            this.loadMoreBtn.addEventListener('click', () => {
                this.loadComments(false);
            });

            // Emoji 按钮
            if (this.emojiBtn) {
                this.emojiBtn.addEventListener('click', () => {
                    window.EmojiPicker.toggle();
                });
            }

            // Markdown 预览
            if (this.previewBtn) {
                this.previewBtn.addEventListener('click', () => {
                    const visible = this.previewEl.style.display !== 'none';
                    if (visible) {
                        this.previewEl.style.display = 'none';
                        this.contentEl.style.display = '';
                    } else {
                        this.previewContent.innerHTML = Markdown.render(this.contentEl.value) || '<p style="color:var(--text-muted)">在左侧输入内容即可预览</p>';
                        this.previewEl.style.display = 'block';
                        this.contentEl.style.display = 'none';
                    }
                });
            }

            // 评论列表事件委托
            this.listEl.addEventListener('click', (e) => {
                const likeBtn = e.target.closest('.gb-like-btn');
                const replyBtn = e.target.closest('.gb-reply-btn');
                const deleteBtn = e.target.closest('.gb-delete-btn');
                const showMoreBtn = e.target.closest('.gb-show-more-replies');

                if (likeBtn) this.toggleLike(likeBtn);
                else if (replyBtn) this.startReply(replyBtn);
                else if (deleteBtn) this.confirmDelete(deleteBtn);
                else if (showMoreBtn) this.loadAllReplies(showMoreBtn);
            });

            // 点击外部关闭 Emoji Picker
            document.addEventListener('click', (e) => {
                if (this.emojiPickerEl && !this.emojiPickerEl.contains(e.target) && e.target !== this.emojiBtn) {
                    window.EmojiPicker.hide();
                }
            });
        },

        // ---- 加载评论 ----
        async loadComments(reset) {
            if (this.state.isLoading) return;
            this.state.isLoading = true;

            if (reset) {
                this.state.cursor = null;
                this.state.hasMore = false;
                this.listEl.innerHTML = renderSkeleton();
                this.loadMoreEl.style.display = 'none';
            }

            try {
                const data = await API.getComments(this.state.sort, this.state.cursor);
                this.state.total = data.total;
                this.state.hasMore = data.has_more;
                this.state.cursor = data.next_cursor;

                if (reset) this.listEl.innerHTML = '';

                if (data.comments.length === 0 && reset) {
                    this.listEl.innerHTML = renderEmpty();
                } else {
                    data.comments.forEach(c => {
                        this.listEl.insertAdjacentHTML('beforeend', renderComment(c));
                    });
                }

                // 更新计数
                this.countEl.textContent = `${this.state.total} 条留言`;

                // 显示/隐藏加载更多
                this.loadMoreEl.style.display = this.state.hasMore ? '' : 'none';
            } catch (err) {
                console.error('加载评论失败:', err);
                if (reset) {
                    this.listEl.innerHTML = `<div class="gb-empty"><p>加载失败，请检查网络后刷新页面</p></div>`;
                }
                showToast('加载评论失败', 'error');
            } finally {
                this.state.isLoading = false;
            }
        },

        // ---- 提交评论 ----
        async submitComment() {
            if (this.state.submitting) return;

            const nickname = this.nicknameEl.value.trim();
            const content = this.contentEl.value.trim();

            if (!nickname) { showToast('请输入昵称', 'error'); return; }
            if (!content) { showToast('请输入评论内容', 'error'); return; }

            this.state.submitting = true;
            this.submitBtn.classList.add('loading');
            this.submitBtn.disabled = true;

            try {
                const data = await API.createComment(nickname, content, this.state.replyingTo?.id || null);
                storeToken(data.id, data.token);
                localStorage.setItem(NICKNAME_KEY, nickname);

                // 清空表单
                this.contentEl.value = '';
                this.charCountEl.textContent = '0';
                this.cancelReply();

                // 构建新评论 HTML 并插入
                const newComment = {
                    id: data.id,
                    nickname: data.nickname,
                    content: data.content,
                    likes: 0,
                    created_at: data.created_at,
                    replies: [],
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
                    // 热门排序下，新评论（0赞）放最后
                    this.listEl.appendChild(card);
                }

                this.state.total++;
                this.countEl.textContent = `${this.state.total} 条留言`;
                showToast('留言发表成功 🎉', 'success');

                // 成功动画
                this.submitBtn.classList.remove('loading');
                this.submitBtn.classList.add('success');
                setTimeout(() => {
                    this.submitBtn.classList.remove('success');
                }, 1500);

            } catch (err) {
                showToast(err.message || '提交失败，请稍后再试', 'error');
                this.submitBtn.classList.remove('loading');
            } finally {
                this.state.submitting = false;
                this.submitBtn.disabled = false;
            }
        },

        // ---- 回复 ----
        startReply(btn) {
            const id = parseInt(btn.dataset.id);
            const nickname = btn.dataset.nickname;
            this.state.replyingTo = { id, nickname };

            // 在表单前显示回复提示
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

            // 滚动到表单
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
            const id = parseInt(btn.dataset.id);
            const token = getToken(id);
            if (!token) { showToast('无法验证身份', 'error'); return; }

            // 创建确认弹窗
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
                    const card = $(`.gb-card[data-id="${id}"]`);
                    if (card) {
                        card.style.transition = 'all 0.4s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(-10px) scale(0.98)';
                        setTimeout(() => card.remove(), 400);
                    }
                    this.state.total = Math.max(0, this.state.total - 1);
                    this.countEl.textContent = `${this.state.total} 条留言`;
                    showToast('留言已删除', 'success');
                } catch (err) {
                    showToast(err.message || '删除失败', 'error');
                }
            });
        },

        // ---- 点赞 ----
        async toggleLike(btn) {
            const id = parseInt(btn.dataset.id);
            const likedKey = `gb_liked_${id}`;
            const wasLiked = localStorage.getItem(likedKey) === '1';
            const countEl = btn.querySelector('.gb-like-count');
            const svgEl = btn.querySelector('svg');
            const currentCount = parseInt(countEl.textContent) || 0;

            // 乐观更新
            const newLiked = !wasLiked;
            const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
            localStorage.setItem(likedKey, newLiked ? '1' : '0');
            btn.classList.toggle('liked', newLiked);
            svgEl.setAttribute('fill', newLiked ? 'currentColor' : 'none');
            countEl.textContent = newCount;

            try {
                const result = await API.toggleLike(id);
                // 以服务端为准
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
            }
        },

        // ---- 加载全部回复 ----
        async loadAllReplies(btn) {
            const parentId = btn.dataset.parentId;
            btn.textContent = '加载中...';
            btn.disabled = true;

            try {
                const data = await API.getReplies(parentId);
                const repliesContainer = this.listEl.querySelector(`.gb-replies[data-parent-id="${parentId}"]`);
                if (!repliesContainer) return;

                // 清除已有回复，渲染全部
                repliesContainer.innerHTML = '';
                data.replies.forEach(reply => {
                    repliesContainer.insertAdjacentHTML('beforeend', renderComment(reply, true));
                });
            } catch (err) {
                showToast('加载回复失败', 'error');
                btn.textContent = '重试';
                btn.disabled = false;
            }
        },

        // ---- 昵称持久化 ----
        restoreNickname() {
            const saved = localStorage.getItem(NICKNAME_KEY);
            if (saved && this.nicknameEl) {
                this.nicknameEl.value = saved;
            }
        },
    };

    // ---- 初始化 ----
    function init() {
        Guestbook.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
