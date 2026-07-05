;(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const API_BASE = '/api';

    function getAuthHeader() {
        const token = localStorage.getItem('admin_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    const Admin = {
        state: {
            isLoggedIn: false,
            view: 'comments', // 'comments', 'posts', 'editor'
            comments: [],
            posts: [],
            editingPost: null // null if creating new
        },

        confirm(msg) {
            return new Promise(function (resolve) {
                var overlay = document.createElement('div');
                overlay.className = 'admin-confirm-overlay';
                overlay.innerHTML =
                    '<div class="admin-confirm-box">' +
                        '<p class="admin-confirm-msg">' + msg + '</p>' +
                        '<div class="admin-confirm-actions">' +
                            '<button class="admin-confirm-cancel">取消</button>' +
                            '<button class="admin-confirm-ok">确定</button>' +
                        '</div>' +
                    '</div>';
                overlay.querySelector('.admin-confirm-ok').addEventListener('click', function () {
                    overlay.remove();
                    resolve(true);
                });
                overlay.querySelector('.admin-confirm-cancel').addEventListener('click', function () {
                    overlay.remove();
                    resolve(false);
                });
                document.body.appendChild(overlay);
            });
        },

        init() {
            this.container = $('#admin-container');
            if (!this.container) return;

            const token = localStorage.getItem('admin_token');
            if (token) {
                this.state.isLoggedIn = true;
                this.showDashboard();
            } else {
                this.renderLogin();
            }

            this.bindEvents();
        },

        bindEvents() {
            this.container.addEventListener('click', (e) => {
                const loginSubmit = e.target.closest('#admin-login-btn');
                const navComments = e.target.closest('#admin-nav-comments');
                const navPosts = e.target.closest('#admin-nav-posts');
                const navLogout = e.target.closest('#admin-nav-logout');
                
                // Action buttons
                const btnDeleteComment = e.target.closest('.admin-delete-comment');
                const btnNewPost = e.target.closest('#admin-new-post');
                const btnEditPost = e.target.closest('.admin-edit-post');
                const btnDeletePost = e.target.closest('.admin-delete-post');
                const btnCancelEdit = e.target.closest('#admin-cancel-edit');
                const btnSavePost = e.target.closest('#admin-save-post');

                if (loginSubmit) {
                    e.preventDefault();
                    this.handleLogin();
                } else if (navComments) {
                    this.state.view = 'comments';
                    this.loadComments();
                } else if (navPosts) {
                    this.state.view = 'posts';
                    this.loadPosts();
                } else if (navLogout) {
                    this.handleLogout();
                } else if (btnDeleteComment) {
                    const id = btnDeleteComment.dataset.id;
                    this.deleteComment(id);
                } else if (btnNewPost) {
                    this.showEditor(null);
                } else if (btnEditPost) {
                    const id = btnEditPost.dataset.id;
                    this.showEditor(id);
                } else if (btnDeletePost) {
                    const id = btnDeletePost.dataset.id;
                    this.deletePost(id);
                } else if (btnCancelEdit) {
                    this.state.view = 'posts';
                    this.loadPosts();
                } else if (btnSavePost) {
                    e.preventDefault();
                    this.savePost();
                }
            });
        },

        async handleLogin() {
            const password = $('#admin-password').value;
            if (!password) return;

            try {
                const res = await fetch(`${API_BASE}/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '登录失败');

                localStorage.setItem('admin_token', data.token);
                this.state.isLoggedIn = true;
                this.showDashboard();
            } catch (err) {
                if (window.Toast) window.Toast.show('登录失败: ' + err.message, 'error');
            }
        },

        handleLogout() {
            localStorage.removeItem('admin_token');
            this.state.isLoggedIn = false;
            this.renderLogin();
        },

        showDashboard() {
            this.loadComments();
        },

        async loadComments() {
            this.renderLoading();
            try {
                const token = localStorage.getItem('admin_token');
                const res = await fetch(`${API_BASE}/admin/comments`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const body = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
                this.state.comments = JSON.parse(body);
                this.renderCommentsDashboard();
            } catch (err) {
                this.renderError('加载失败 [' + err.message + ']');
            }
        },

        async deleteComment(id) {
            var self = this;
            if (!await self.confirm('确定要删除这条评论吗？此操作无法恢复。')) return;

            try {
                const res = await fetch(`${API_BASE}/admin/comments?id=${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeader()
                });
                if (!res.ok) throw new Error('删除失败');
                self.loadComments();
            } catch (err) {
                if (window.Toast) window.Toast.show('删除失败: ' + err.message, 'error');
            }
        },

        async loadPosts() {
            this.renderLoading();
            try {
                const token = localStorage.getItem('admin_token');
                const res = await fetch(`${API_BASE}/admin/posts`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const body = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
                this.state.posts = JSON.parse(body);
                this.renderPostsDashboard();
            } catch (err) {
                this.renderError('加载失败 [' + err.message + ']');
            }
        },

        async deletePost(id) {
            var self = this;
            if (!await self.confirm('确定要删除这篇文章吗？此操作无法恢复。')) return;

            try {
                const res = await fetch(`${API_BASE}/admin/posts?id=${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeader()
                });
                if (!res.ok) throw new Error('删除失败');
                self.loadPosts();
            } catch (err) {
                if (window.Toast) window.Toast.show('删除失败: ' + err.message, 'error');
            }
        },

        showEditor(id) {
            this.state.view = 'editor';
            if (id) {
                const post = this.state.posts.find(p => String(p.id) === String(id));
                this.state.editingPost = post || null;
            } else {
                this.state.editingPost = null;
            }
            this.renderEditor();
        },

        async savePost() {
            const title = $('#editor-title').value.trim();
            const slug = $('#editor-slug').value.trim();
            const content = $('#editor-content').value.trim();
            const excerpt = $('#editor-excerpt').value.trim();
            const published = $('#editor-published').checked;

            if (!title || !slug || !content) {
                if (window.Toast) window.Toast.show('请填写标题、路径和内容', 'error');
                return;
            }

            const body = { title, slug, content, excerpt, published };
            const isEdit = !!this.state.editingPost;
            const url = isEdit ? `${API_BASE}/admin/posts?id=${this.state.editingPost.id}` : `${API_BASE}/admin/posts`;
            const method = isEdit ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                    },
                    body: JSON.stringify(body)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '保存失败');

                this.state.view = 'posts';
                this.loadPosts();
            } catch (err) {
                if (window.Toast) window.Toast.show('保存失败: ' + err.message, 'error');
            }
        },

        renderLogin() {
            this.container.innerHTML = `
                <div class="admin-login-card">
                    <h3>管理员登录</h3>
                    <form id="admin-login-form">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <input type="password" id="admin-password" placeholder=" " required>
                            <label for="admin-password">输入管理密钥</label>
                            <div class="form-glow"></div>
                        </div>
                        <button type="submit" class="btn btn-primary" id="admin-login-btn" style="width:100%">登录</button>
                    </form>
                </div>`;
        },

        renderHeader() {
            return `
                <div class="admin-header">
                    <div class="admin-nav">
                        <button class="admin-nav-btn ${this.state.view === 'comments' ? 'active' : ''}" id="admin-nav-comments">评论管理</button>
                        <button class="admin-nav-btn ${this.state.view === 'posts' ? 'active' : ''}" id="admin-nav-posts">文章管理</button>
                    </div>
                    <button class="btn btn-ghost btn-sm" id="admin-nav-logout">退出</button>
                </div>`;
        },

        renderCommentsDashboard() {
            let html = `
                <div class="admin-dashboard">
                    ${this.renderHeader()}
                    <div class="admin-content-area">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>用户</th>
                                    <th>内容</th>
                                    <th>状态</th>
                                    <th>日期</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>`;
            
            this.state.comments.forEach(c => {
                const isDel = c.is_deleted ? '<span style="color:#ef4444">已删除</span>' : '<span style="color:#22c55e">正常</span>';
                html += `
                    <tr>
                        <td style="font-weight:600">${c.nickname}</td>
                        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.content}</td>
                        <td>${isDel}</td>
                        <td style="font-family:var(--font-mono);font-size:0.8rem">${new Date(c.created_at).toLocaleString()}</td>
                        <td>
                            ${!c.is_deleted ? `<button class="btn btn-danger btn-sm admin-delete-comment" data-id="${c.id}">删除</button>` : ''}
                        </td>
                    </tr>`;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
            this.container.innerHTML = html;
        },

        renderPostsDashboard() {
            let html = `
                <div class="admin-dashboard">
                    ${this.renderHeader()}
                    <div style="display:flex;justify-content:flex-end">
                        <button class="btn btn-primary btn-sm" id="admin-new-post">新建文章</button>
                    </div>
                    <div class="admin-content-area">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>标题</th>
                                    <th>路径 (Slug)</th>
                                    <th>状态</th>
                                    <th>更新日期</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>`;

            this.state.posts.forEach(p => {
                const status = p.published ? '<span style="color:#22c55e">已发布</span>' : '<span style="color:var(--text-tertiary)">草稿</span>';
                html += `
                    <tr>
                        <td style="font-weight:600">${p.title}</td>
                        <td style="font-family:var(--font-mono)">${p.slug}</td>
                        <td>${status}</td>
                        <td style="font-family:var(--font-mono);font-size:0.8rem">${new Date(p.updated_at || p.created_at).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-ghost btn-sm admin-edit-post" data-id="${p.id}" style="margin-right:8px">编辑</button>
                            <button class="btn btn-danger btn-sm admin-delete-post" data-id="${p.id}">删除</button>
                        </td>
                    </tr>`;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
            this.container.innerHTML = html;
        },

        renderEditor() {
            const post = this.state.editingPost || { title: '', slug: '', content: '', excerpt: '', published: true };
            const isEdit = !!this.state.editingPost;

            this.container.innerHTML = `
                <div class="admin-dashboard">
                    ${this.renderHeader()}
                    <form class="admin-editor">
                        <div class="admin-editor-row">
                            <div class="form-group">
                                <input type="text" id="editor-title" value="${post.title}" placeholder=" " required>
                                <label for="editor-title">文章标题</label>
                                <div class="form-glow"></div>
                            </div>
                            <div class="form-group">
                                <input type="text" id="editor-slug" value="${post.slug}" placeholder=" " required>
                                <label for="editor-slug">URL 路径 (slug)</label>
                                <div class="form-glow"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <input type="text" id="editor-excerpt" value="${post.excerpt}" placeholder=" ">
                            <label for="editor-excerpt">文章摘要 (可选)</label>
                            <div class="form-glow"></div>
                        </div>
                        <div class="admin-editor-split">
                            <textarea id="editor-content" class="admin-editor-textarea" placeholder="在此输入 Markdown 正文...">${post.content}</textarea>
                            <div id="editor-preview" class="admin-editor-preview"></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px">
                            <input type="checkbox" id="editor-published" ${post.published ? 'checked' : ''} style="width:20px;height:20px">
                            <label for="editor-published" style="cursor:pointer;font-weight:600">立即发布文章</label>
                        </div>
                        <div class="admin-editor-actions">
                            <button type="button" class="btn btn-ghost" id="admin-cancel-edit">取消</button>
                            <button type="submit" class="btn btn-primary" id="admin-save-post">${isEdit ? '保存修改' : '发表文章'}</button>
                        </div>
                    </form>
                </div>`;

            const textarea = $('#editor-content');
            const preview = $('#editor-preview');

            // Live markdown preview
            if (textarea && preview) {
                const updatePreview = () => {
                    preview.innerHTML = window.Markdown ? window.Markdown.render(textarea.value) : textarea.value;
                };
                textarea.addEventListener('input', updatePreview);
                updatePreview(); // Initial render
            }
        },

        renderLoading() {
            this.container.innerHTML = `
                <div class="admin-dashboard">
                    ${this.renderHeader()}
                    <div style="display:flex;justify-content:center;padding:80px 0">
                        <svg class="spinner" viewBox="0 0 24 24" style="width:40px;height:40px"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
                    </div>
                </div>`;
        },

        renderError(msg) {
            this.container.innerHTML = `
                <div class="admin-dashboard">
                    ${this.renderHeader()}
                    <div class="gb-empty">
                        <p>${msg}</p>
                        <button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">重试</button>
                    </div>
                </div>`;
        }
    };

    window.Admin = Admin;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Admin.init());
    } else {
        Admin.init();
    }
})();
