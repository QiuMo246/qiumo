;(function () {
  'use strict';

  const API_ENDPOINT = '/api/chat';
  const MAX_HISTORY = 10;
  const STORAGE_KEY = 'qiumo_ai_model';

  const MODELS = [
    { key: 'zhipu', label: '智谱 GLM-4-Flash (永久免费)' },
    { key: 'siliconflow', label: '通义千问 (Qwen3-8B)' },
    { key: 'relay', label: 'Claude Opus 4.5' },
  ];

  let messages = [];
  let isStreaming = false;
  let currentModel = localStorage.getItem(STORAGE_KEY) || 'zhipu';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('data')) e.setAttribute(k.replace(/([A-Z])/g, '-$1').toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => { if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function getModelLabel(key) {
    const m = MODELS.find(m => m.key === key);
    return m ? m.label : key;
  }

  const AIChat = {
    container: null,
    messagesEl: null,
    input: null,
    sendBtn: null,
    countEl: null,
    remainingEl: null,
    modelSelect: null,

    init() {
      this.container = $('#chatContainer');
      if (!this.container) return;
      this.messagesEl = $('#chatMessages');
      this.input = $('#chatInput');
      this.sendBtn = $('#chatSendBtn');
      this.countEl = $('#chatCount');
      this.remainingEl = $('#chatRemaining');
      this.modelSelect = $('#chatModelSelect');

      this.renderModelSelector();
      this.bindEvents();
      this.loadRemaining();
      this.addWelcomeMessage();
    },

    renderModelSelector() {
      const wrapper = $('#chatModelWrapper');
      wrapper.innerHTML = '';
      const select = el('select', { className: 'chat-model-select', id: 'chatModelSelect' });
      MODELS.forEach(m => {
        const opt = el('option', { value: m.key });
        opt.textContent = m.label;
        if (m.key === currentModel) opt.selected = true;
        select.appendChild(opt);
      });
      wrapper.appendChild(select);
      this.modelSelect = select;
    },

    bindEvents() {
      this.sendBtn.addEventListener('click', () => this.send());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.send();
        }
      });
      this.input.addEventListener('input', () => {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
      });
      document.addEventListener('change', (e) => {
        if (e.target.id === 'chatModelSelect') {
          currentModel = e.target.value;
          localStorage.setItem(STORAGE_KEY, currentModel);
          this.clearChat();
        }
      });
    },

    clearChat() {
      messages = [];
      this.messagesEl.innerHTML = '';
      this.addWelcomeMessage();
    },

    async loadRemaining() {
      try {
        const res = await fetch(API_ENDPOINT + '?action=check');
        const data = await res.json();
        this.updateCount(data.remaining);
      } catch {
        this.countEl.textContent = '?';
      }
    },

    updateCount(remaining) {
      this.countEl.textContent = remaining;
      if (remaining <= 5) {
        this.remainingEl.style.color = '#f59e0b';
      } else {
        this.remainingEl.style.color = '';
      }
      if (remaining <= 0) {
        this.showLimitReached();
      }
    },

    addWelcomeMessage() {
      this.addMessage('assistant', '你好！我是 ' + getModelLabel(currentModel) + '，有什么可以帮你的吗？');
    },

    addMessage(role, content) {
      const msgEl = el('div', { className: 'chat-message ' + role });

      let avatar;
      if (role === 'user') {
        avatar = el('div', { className: 'chat-avatar' }, '你');
      } else if (role === 'error') {
        avatar = el('div', { className: 'chat-avatar' }, '!');
      } else {
        avatar = el('div', { className: 'chat-avatar' }, 'AI');
      }
      msgEl.appendChild(avatar);

      if (content === '__loading__') {
        const bubble = el('div', { className: 'chat-bubble loading' });
        for (let i = 0; i < 3; i++) {
          bubble.appendChild(el('span', { className: 'chat-dot' }));
        }
        msgEl.appendChild(bubble);
        msgEl.dataset.loading = 'true';
      } else {
        const bubble = el('div', { className: 'chat-bubble' });
        bubble.textContent = content;
        msgEl.appendChild(bubble);
      }

      this.messagesEl.appendChild(msgEl);
      this.scrollToBottom();
      return msgEl;
    },

    updateLastMessage(content) {
      const msgs = this.messagesEl.querySelectorAll('.chat-message');
      const last = msgs[msgs.length - 1];
      if (!last) return;
      const bubble = last.querySelector('.chat-bubble');
      if (bubble) bubble.textContent = content;
      this.scrollToBottom();
    },

    removeLoadingIndicator() {
      const loading = this.messagesEl.querySelector('[data-loading="true"]');
      if (loading) loading.remove();
    },

    scrollToBottom() {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    },

    showLimitReached() {
      this.input.disabled = true;
      this.sendBtn.disabled = true;
      this.input.placeholder = '今日次数已用完，明天再来吧';
    },

    async send() {
      const text = this.input.value.trim();
      if (!text || isStreaming) return;

      this.input.value = '';
      this.input.style.height = 'auto';
      this.addMessage('user', text);

      messages.push({ role: 'user', content: text });

      this.addMessage('assistant', '__loading__');
      isStreaming = true;
      this.sendBtn.disabled = true;

      try {
        const res = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: currentModel,
            messages: messages.slice(-MAX_HISTORY),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          this.removeLoadingIndicator();
          if (res.status === 429) {
            this.addMessage('error', '今日对话次数已用完，明天再来吧。');
            this.showLimitReached();
          } else {
            this.addMessage('error', err.error || '请求失败，请稍后重试。');
          }
          isStreaming = false;
          this.sendBtn.disabled = false;
          messages.pop();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        let isFirstChunk = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              let delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (isFirstChunk) {
                  delta = delta.replace(/^\n+/, '');
                  isFirstChunk = false;
                }
                if (delta) {
                  fullContent += delta;
                  this.updateLastMessage(fullContent);
                }
              }
            } catch {}
          }
        }

        messages.push({ role: 'assistant', content: fullContent });
        this.loadRemaining();

      } catch (err) {
        this.removeLoadingIndicator();
        this.addMessage('error', '网络错误，请检查连接后重试。');
      } finally {
        isStreaming = false;
        this.sendBtn.disabled = false;
      }
    },
  };

  window.AIChat = AIChat;
})();
