// ============================================
// 轻量 Markdown 解析器
// 支持：加粗、斜体、行内代码、删除线、链接、列表、代码块
// ============================================

;(function () {
    'use strict';

    /**
     * HTML 实体转义
     */
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * 验证 URL 安全性
     */
    function safeUrl(url) {
        const trimmed = url.trim();
        if (/^(https?:\/\/)/i.test(trimmed)) return trimmed;
        return '';
    }

    /**
     * 渲染 Markdown 文本为 HTML
     */
    function render(text) {
        if (!text) return '';

        // Step 1: HTML 转义
        let html = escapeHtml(text);

        // Step 2: 提取代码块（用占位符保护）
        const codeBlocks = [];
        html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push('<pre class="gb-code-block"><code>' + code.trim() + '</code></pre>');
            return '\x00CB' + idx + '\x00';
        });

        // Step 3: 提取行内代码
        const inlineCodes = [];
        html = html.replace(/`([^`\n]+)`/g, (_, code) => {
            const idx = inlineCodes.length;
            inlineCodes.push('<code class="gb-inline-code">' + code + '</code>');
            return '\x00IC' + idx + '\x00';
        });

        // Step 4: 加粗
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Step 5: 斜体
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Step 6: 删除线
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Step 7: 图片 → 渲染为安全链接文本
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
            const safe = safeUrl(url);
            return safe
                ? '<span class="gb-md-image">[' + (alt || '图片') + '](' + safe + ')</span>'
                : alt;
        });

        // Step 8: 链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
            const safe = safeUrl(url);
            return safe
                ? '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' + text + '</a>'
                : text;
        });

        // Step 9: 无序列表
        html = html.replace(/(^|\n)((?:- .+\n?)+)/g, (_, pre, block) => {
            const items = block.trim().split('\n').map(line => {
                return '<li>' + line.replace(/^- /, '') + '</li>';
            }).join('');
            return pre + '<ul class="gb-md-list">' + items + '</ul>';
        });

        // Step 10: 段落处理（双换行 → 段落，单换行 → <br>）
        html = html.split(/\n{2,}/).map(block => {
            // 跳过已经是 HTML 块级元素的
            if (/^<(pre|ul|ol|blockquote|h[1-6]|div)/.test(block.trim())) {
                return block.trim();
            }
            return '<p>' + block.trim().replace(/\n/g, '<br>') + '</p>';
        }).join('\n');

        // Step 11: 恢复代码块
        codeBlocks.forEach((block, i) => {
            html = html.replace('\x00CB' + i + '\x00', block);
        });

        // Step 12: 恢复行内代码
        inlineCodes.forEach((code, i) => {
            html = html.replace('\x00IC' + i + '\x00', code);
        });

        return html;
    }

    window.Markdown = { render };
})();
