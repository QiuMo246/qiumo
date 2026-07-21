// ============================================
// Emoji 选择器组件
// ============================================

;(function () {
    'use strict';

    const EMOJIS = [
        // 表情
        '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳',
        '😏','😅','😉','🤔','🤫','🤭','😐','😑','😶','🙄',
        '😢','😭','😤','🤯','😳','🥺','😱','😰','😥','😓',
        // 手势
        '👍','👎','👏','🙌','🤝','💪','✌️','🤞','🤟','👋',
        '🙏','✍️','👀','🫶','❤️','🔥','✨','🎉','🎊','💯',
        // 心形
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
        // 物品
        '☕','🌟','⚡','🎯','🚀','💻','📱','🎨','🎵','📚',
        '🏆','💎','🌈','🌙','☀️','🍕','🍰','🧊','🫧','🪄',
    ];

    let textareaEl = null;
    let pickerEl = null;
    let isVisible = false;

    function createGrid() {
        const grid = document.createElement('div');
        grid.className = 'gb-emoji-grid';
        EMOJIS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gb-emoji-item';
            btn.textContent = emoji;
            btn.title = emoji;
            btn.addEventListener('click', () => insertEmoji(emoji));
            grid.appendChild(btn);
        });
        return grid;
    }

    function insertEmoji(emoji) {
        if (!textareaEl) return;
        const start = textareaEl.selectionStart;
        const end = textareaEl.selectionEnd;
        const text = textareaEl.value;
        textareaEl.value = text.slice(0, start) + emoji + text.slice(end);
        // 光标移到 emoji 之后
        const pos = start + emoji.length;
        textareaEl.setSelectionRange(pos, pos);
        textareaEl.focus();
        // 触发 input 事件更新字数统计
        textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.EmojiPicker = {
        init(textarea, picker) {
            textareaEl = textarea;
            pickerEl = picker;
            pickerEl.appendChild(createGrid());
        },

        toggle() {
            if (!pickerEl) return;
            isVisible = !isVisible;
            pickerEl.style.display = isVisible ? 'block' : 'none';
        },

        hide() {
            isVisible = false;
            if (pickerEl) pickerEl.style.display = 'none';
        },

        get isVisible() {
            return isVisible;
        }
    };
})();
