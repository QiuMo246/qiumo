;(function () {
    'use strict';

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const API_BASE = '/api';

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const Blog = {
        state: {
            posts: [],
            currentPost: null,
            view: 'list', // 'list' or 'detail'
            isLoading: false
        },

        init() {
            this.container = $('#blog-container');
            if (!this.container) return;

            this.bindEvents();
            this.loadPosts();

            // Hash router listener for direct links
            window.addEventListener('hashchange', () => this.handleRouting());
            this.handleRouting();
        },

        handleRouting() {
            const hash = window.location.hash;
            const match = hash.match(/^#blog\/([^/]+)$/);
            if (match) {
                const slug = match[1];
                this.loadPost(slug);
            } else if (hash === '#blog') {
                this.showList();
            }
        },

        bindEvents() {
            this.container.addEventListener('click', (e) => {
                const card = e.target.closest('.blog-card');
                const backBtn = e.target.closest('.blog-back-btn');

                if (card) {
                    const slug = card.dataset.slug;
                    window.location.hash = `#blog/${slug}`;
                } else if (backBtn) {
                    window.location.hash = '#blog';
                }
            });
        },

        async loadPosts() {
            if (this.state.isLoading) return;
            this.state.isLoading = true;
            this.renderSkeleton();

            try {
                const res = await fetch(`${API_BASE}/posts`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '加载博客失败');
                this.state.posts = data;
                this.state.view = 'list';
                this.renderList();
            } catch (err) {
                this.renderError(err.message || '加载博客列表失败');
            } finally {
                this.state.isLoading = false;
            }
        },

        async loadPost(slug) {
            if (this.state.isLoading) return;
            this.state.isLoading = true;
            if (this.container) this.container.innerHTML = '';

            try {
                const res = await fetch(`${API_BASE}/posts?slug=${encodeURIComponent(slug)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || '文章未找到');
                this.state.currentPost = data;
                this.state.view = 'detail';
                this.renderDetail();
            } catch (err) {
                this.renderError(err.message || '加载文章失败，请重试');
            } finally {
                this.state.isLoading = false;
            }
        },

        showList() {
            this.state.view = 'list';
            if (this.state.posts.length > 0) {
                this.renderList();
            } else {
                this.loadPosts();
            }
        },

        renderList() {
            if (this.state.posts.length === 0) {
                this.container.innerHTML = `
                    <div class="gb-empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        <p>目前还没有发表文章，过阵子再来看看吧~</p>
                    </div>`;
                return;
            }

            let html = '<div class="blog-list">';
            this.state.posts.forEach(post => {
                html += `
                    <div class="blog-card" data-slug="${post.slug}">
                        <div class="blog-card-meta">
                            <span>发布于 ${formatDate(post.created_at)}</span>
                        </div>
                        <h3 class="blog-card-title">${post.title}</h3>
                        <p class="blog-card-excerpt">${post.excerpt || '点击阅读全文...'}</p>
                        <div class="blog-card-more">
                            <span>阅读全文</span>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>`;
            });
            html += '</div>';
            this.container.innerHTML = html;
        },

        renderDetail() {
            const post = this.state.currentPost;
            if (!post) return;

            // Render using custom Markdown engine already loaded in system
            const renderedContent = window.Markdown ? window.Markdown.render(post.content) : post.content;

            this.container.innerHTML = `
                <div class="blog-post-detail">
                    <button class="blog-back-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                        </svg>
                        <span>返回博客列表</span>
                    </button>
                    <article class="blog-post">
                        <header class="blog-post-header">
                            <h1 class="blog-post-title">${post.title}</h1>
                            <div class="blog-post-meta">
                                <span>发布于 ${formatDate(post.created_at)}</span>
                            </div>
                        </header>
                        <div class="blog-post-content">${renderedContent}</div>
                    </article>
                </div>`;
        },

        renderSkeleton() {
            let html = '<div class="blog-list">';
            for (let i = 0; i < 3; i++) {
                html += `
                    <div class="gb-card gb-skeleton-card blog-skeleton-card">
                        <div class="gb-skeleton gb-skeleton-line" style="width:120px;height:12px;margin-bottom:16px"></div>
                        <div class="gb-skeleton gb-skeleton-line" style="width:60%;height:24px;margin-bottom:16px"></div>
                        <div class="gb-skeleton gb-skeleton-line" style="width:100%;height:14px;margin-bottom:8px"></div>
                        <div class="gb-skeleton gb-skeleton-line" style="width:75%;height:14px;margin-bottom:20px"></div>
                        <div class="gb-skeleton gb-skeleton-line" style="width:70px;height:14px"></div>
                    </div>`;
            }
            html += '</div>';
            this.container.innerHTML = html;
        },

        renderSkeletonDetail() {
            this.container.innerHTML = `
                <div class="blog-post-detail">
                    <div class="gb-skeleton gb-skeleton-line" style="width:120px;height:14px;margin-bottom:32px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:70%;height:36px;margin-bottom:16px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:150px;height:12px;margin-bottom:40px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:100%;height:16px;margin-bottom:16px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:90%;height:16px;margin-bottom:16px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:95%;height:16px;margin-bottom:32px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:40%;height:20px;margin-bottom:16px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:100%;height:16px;margin-bottom:16px"></div>
                    <div class="gb-skeleton gb-skeleton-line" style="width:85%;height:16px;margin-bottom:16px"></div>
                </div>`;
        },

        renderError(msg) {
            this.container.innerHTML = `
                <div class="gb-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>${msg}</p>
                    <button class="btn btn-ghost" style="margin-top:16px" onclick="location.reload()">重新加载</button>
                </div>`;
        }
    };

    window.Blog = Blog;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Blog.init());
    } else {
        Blog.init();
    }
})();
