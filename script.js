/* ============================================
   秋末 // CYBER_NEXUS
   Main Script — Cyberpunk Interactions
   ============================================ */
;(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ============================================
     ENTRY / LOGIN SYSTEM
     ============================================ */
  const EntrySystem = {
    entry: null,
    nameInput: null,
    submitBtn: null,
    avatars: [],
    selectedSeed: 'Felix',
    guestName: '访客',

    init() {
      this.entry = $('#entryScreen');
      this.nameInput = $('#entryName');
      this.submitBtn = $('#entrySubmit');
      this.avatars = $$('.avatar-btn:not(.avatar-add)');

      this.bindAvatars();
      this.bindNameInput();
      this.bindSubmit();
      this.bindAvatarUpload();
    },

    bindAvatars() {
      this.avatars.forEach(btn => {
        btn.addEventListener('click', () => {
          this.avatars.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedSeed = btn.dataset.seed;
          this.checkReady();
        });
      });
    },

    bindNameInput() {
      this.nameInput.addEventListener('input', () => {
        this.checkReady();
      });
    },

    checkReady() {
      const name = this.nameInput.value.trim();
      if (name && this.selectedSeed) {
        this.submitBtn.disabled = false;
      } else {
        this.submitBtn.disabled = true;
      }
    },

    bindSubmit() {
      this.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.submitBtn.disabled) return;
        this.guestName = this.nameInput.value.trim() || '访客';
        this.enterMain();
      });

      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !this.submitBtn.disabled) {
          this.guestName = this.nameInput.value.trim() || '访客';
          this.enterMain();
        }
      });
    },

    bindAvatarUpload() {
      const addBtn = $('.avatar-add');
      const uploadInput = $('.avatar-upload');
      addBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = document.createElement('img');
          img.src = ev.target.result;
          const newBtn = document.createElement('button');
          newBtn.className = 'avatar-btn active';
          newBtn.appendChild(img);
          addBtn.parentNode.insertBefore(newBtn, addBtn);
          this.avatars.forEach(b => b.classList.remove('active'));
          this.selectedSeed = 'custom';
          this.checkReady();
        };
        reader.readAsDataURL(file);
      });
    },

    enterMain() {
      this.entry.classList.add('hidden');

      const mainLayout = $('#mainLayout');
      mainLayout.style.display = 'flex';
      document.body.style.overflow = 'auto';

      const greeting = $('#sidebarGreeting');
      if (greeting) greeting.textContent = `欢迎来访，${this.guestName}`;

      const avatarImg = $('#sidebarAvatar img');
      if (avatarImg) {
        if (this.selectedSeed === 'custom') {
          const activeAvatar = $('.avatar-btn.active img');
          if (activeAvatar) avatarImg.src = activeAvatar.src;
        } else {
          avatarImg.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${this.selectedSeed}`;
        }
      }

      setTimeout(() => {
        this.entry.style.display = 'none';
      }, 900);

      if (typeof Toast !== 'undefined') {
        setTimeout(() => Toast.show(`身份同步成功 // WELCOME_${this.guestName}`, 'success'), 500);
      }

      // Trigger counter animations
      if (typeof CounterAnimation !== 'undefined') {
        CounterAnimation.init();
      }
    },
  };

  /* ============================================
     SIDEBAR NAVIGATION
     ============================================ */
  const SidebarNav = {
    init() {
      const links = $$('.side-link');
      const sections = $$('.cyber-section, .admin-section');

      const highlight = () => {
        const scrollY = window.scrollY + window.innerHeight * 0.35;
        let current = '';
        sections.forEach(s => {
          if (s.offsetTop <= scrollY) current = s.getAttribute('id');
        });
        links.forEach(l => {
          l.classList.toggle('active', l.dataset.section === current);
        });
      };

      window.addEventListener('scroll', highlight, { passive: true });

      links.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const href = link.getAttribute('href');
          if (href === '#') return;
          const target = $(href);
          if (!target) return;
          const top = target.getBoundingClientRect().top + window.scrollY - 20;
          window.scrollTo({ top, behavior: 'smooth' });
        });
      });
    },
  };

  /* ============================================
     COUNTER ANIMATION
     ============================================ */
  const CounterAnimation = {
    init() {
      const counters = $$('.cyber-num');
      if (!counters.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      counters.forEach(el => observer.observe(el));
    },

    animateCounter(el) {
      const target = parseInt(el.getAttribute('data-count'), 10);
      const duration = 1800;
      const start = performance.now();

      const update = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    },
  };

  /* ============================================
     MODAL SYSTEM
     ============================================ */
  const ProjectData = {
    1: {
      title: 'Antigravity',
      subtitle: 'OpenCode 专用第三方插件',
      description: `这是一款 OpenCode 专用第三方插件，不用 API 密钥，直接用谷歌账号 OAuth 登录谷歌 Antigravity 服务，就能在 OpenCode 里调用 Claude、Gemini 高端模型。多谷歌账号自动轮换，解决额度限流；同时使用 Antigravity、Gemini CLI 两套免费额度；支持模型深度思考、联网搜索、会话自动重试。`,
      tags: ['TypeScript', 'Shell', 'JavaScript'],
      github: 'https://github.com/NoeFabris/opencode-antigravity-auth',
    },
    2: {
      title: 'Artisan',
      subtitle: '免费的沉浸式氛围感音乐播放器',
      description: `Mineradio 是开发者 XxHuberrr 开源、基于 Electron 打造的沉浸式视觉向桌面音乐播放器，开源协议 GPL-3.0，全程无广告、无功能付费锁、无捆绑软件。原版仅支持 Windows，社区开发者移植出 macOS（Intel/M 芯片双版）、安卓客户端，同时提供网页版。`,
      tags: ['JavaScript', 'HTML', 'NSIS'],
      github: 'https://github.com/XxHuberrr/Mineradio',
    },
    3: {
      title: 'Breeze',
      subtitle: '开源 Python 盲水印库',
      description: `blind_watermark 是国内开发者 guofei9987 开源的 Python 盲水印库，GitHub Star 过万，MIT 开源协议，是目前最易用、落地最多的图片隐形盲水印工具。核心定义：盲水印（Blind Watermark），提取水印不需要原始无水印原图，只需要带水印图片 + 两组密钥即可解析。`,
      tags: ['Python'],
      github: 'https://github.com/guofei9987/blind_watermark',
    },
  };

  const Modal = {
    overlay: null,
    modal: null,
    content: null,
    isOpen: false,

    init() {
      this.overlay = $('#modalOverlay');
      this.modal = $('#modal');
      this.content = $('#modalContent');

      $$('.mc-explore').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.open(btn.getAttribute('data-modal'));
        });
      });

      $$('.matrix-card').forEach(card => {
        card.addEventListener('click', () => {
          this.open(card.getAttribute('data-project'));
        });
      });

      $('#modalClose').addEventListener('click', () => this.close());
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      });
    },

    open(id) {
      const data = ProjectData[id];
      if (!data) return;

      this.content.innerHTML = `
        <h2>${data.title}</h2>
        <p class="modal-subtitle">${data.subtitle}</p>
        <div class="modal-desc">${data.description.split('\n\n').map(p => `<p>${p}</p>`).join('')}</div>
        <div class="modal-tags">${data.tags.map(t => `<span class="mc-tag">${t}</span>`).join('')}</div>
        <a href="${data.github}" target="_blank" rel="noopener" class="modal-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          在 GitHub 上查看
        </a>
      `;

      this.overlay.classList.add('open');
      this.isOpen = true;
      document.body.style.overflow = 'hidden';
    },

    close() {
      this.overlay.classList.remove('open');
      this.isOpen = false;
      document.body.style.overflow = '';
    },
  };

  /* ============================================
     CONTACT FORM
     ============================================ */
  const ContactForm = {
    form: null,
    submitBtn: null,

    init() {
      this.form = $('#contactForm');
      this.submitBtn = $('#submitBtn');
      if (!this.form) return;
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit();
      });
    },

    async submit() {
      const name = $('#formName').value.trim();
      const email = $('#formEmail').value.trim();
      const message = $('#formMessage').value.trim();
      if (!name || !email || !message) return;

      this.submitBtn.classList.add('loading');
      this.submitBtn.disabled = true;

      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message, access_key: '82a46917-515c-4c66-8999-86e87241e708' })
        });
        if (!res.ok) throw new Error('发送失败');
        this.submitBtn.classList.remove('loading');
        this.submitBtn.classList.add('success');
        Toast.show('数据传输成功 // MESSAGE_SENT', 'success');
        setTimeout(() => {
          this.form.reset();
          this.submitBtn.classList.remove('success');
          this.submitBtn.disabled = false;
        }, 2500);
      } catch (err) {
        this.submitBtn.classList.remove('loading');
        this.submitBtn.disabled = false;
        Toast.show('传输失败 // TRANSMISSION_ERROR', 'error');
      }
    },
  };

  /* ============================================
     TOAST
     ============================================ */
  const Toast = {
    container: null,
    init() { this.container = $('#toastContainer'); },

    show(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <div class="toast-icon ${type}">
          ${type === 'success'
            ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          }
        </div>
        <span class="toast-text">${message}</span>
        <div class="toast-progress"></div>
      `;
      this.container.appendChild(toast);
      requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 3500);
    },
  };

  /* ============================================
     SECRET ADMIN (double-click name)
     ============================================ */
  const SecretAdmin = {
    init() {
      const nameEl = $('.sidebar-name');
      const adminSection = $('#admin');
      if (!nameEl || !adminSection) return;

      let isVisible = false;
      nameEl.addEventListener('dblclick', () => {
        if (isVisible) return;
        isVisible = true;
        adminSection.style.display = 'block';
        const top = adminSection.getBoundingClientRect().top + window.scrollY - 20;
        window.scrollTo({ top, behavior: 'smooth' });
        if (typeof Toast !== 'undefined') {
          Toast.show('管理面板已解锁 // ADMIN_UNLOCKED', 'success');
        }
      });
    },
  };

  /* ============================================
     SCROLL REVEAL
     ============================================ */
  const ScrollReveal = {
    progressBar: null,
    observer: null,

    init() {
      this.createProgressBar();
      this.createObserver();
      this.observeAll();
      this.watchNew();
      this.initParallax();
    },

    createProgressBar() {
      const bar = document.createElement('div');
      bar.className = 'scroll-progress';
      document.body.appendChild(bar);
      this.progressBar = bar;

      window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollTop / docHeight : 0;
        bar.style.transform = `scaleX(${progress})`;
      }, { passive: true });
    },

    createObserver() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const stagger = el.dataset.stagger;
            const delay = stagger ? parseFloat(stagger) : 0;
            setTimeout(() => {
              el.classList.add('revealed');
            }, delay * 1000);
            this.observer.unobserve(el);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    },

    observe(el) {
      const type = el.dataset.reveal || 'up';
      el.classList.add(`reveal-${type}`);
      this.observer.observe(el);
    },

    observeAll() {
      $$('[data-reveal]').forEach(el => this.observe(el));
    },

    watchNew() {
      const content = $('#mainContent');
      if (!content) return;
      const mo = new MutationObserver(() => {
        $$('[data-reveal]').forEach(el => {
          if (!el.classList.contains('reveal-up') &&
              !el.classList.contains('reveal-down') &&
              !el.classList.contains('reveal-left') &&
              !el.classList.contains('reveal-right') &&
              !el.classList.contains('reveal-scale') &&
              !el.classList.contains('reveal-fade')) {
            this.observe(el);
          }
        });
      });
      mo.observe(content, { childList: true, subtree: true });
    },

    initParallax() {
      const sections = $$('.cyber-section');
      if (!sections.length) return;

      window.addEventListener('scroll', () => {
        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const viewportCenter = window.innerHeight / 2;
          const offset = (center - viewportCenter) * 0.05;
          section.style.setProperty('--parallax-offset', `${offset}px`);
        });
      }, { passive: true });
    },
  };

  /* ============================================
     GLITCH EFFECT (occasional)
     ============================================ */
  const GlitchEffect = {
    init() {
      const targets = $$('.sidebar-name, .sec-title');
      targets.forEach(el => {
        setInterval(() => {
          if (Math.random() > 0.03) return;
          el.classList.add('glitch-active');
          setTimeout(() => el.classList.remove('glitch-active'), 200);
        }, 4000);
      });
    },
  };

  /* ============================================
     VISUALIZER ANIMATION
     ============================================ */
  const Visualizer = {
    init() {
      const bars = $$('.vis-bar');
      if (!bars.length) return;
      setInterval(() => {
        bars.forEach(bar => {
          const h = Math.floor(Math.random() * 60) + 20;
          bar.style.height = h + '%';
        });
      }, 600);
    },
  };

  /* ============================================
     PARTICLES (Hero Canvas replacement)
     ============================================ */
  const CyberParticles = {
    init() {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.3';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const particles = [];
      const count = 40;

      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.3 + 0.1,
        });
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
              const alpha = (1 - dist / 120) * 0.08;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
          const p = particles[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = canvas.width + 10;
          if (p.x > canvas.width + 10) p.x = -10;
          if (p.y < -10) p.y = canvas.height + 10;
          if (p.y > canvas.height + 10) p.y = -10;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 211, 238, ${p.opacity})`;
          ctx.fill();
        }
        requestAnimationFrame(draw);
      }
      draw();

      window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      });
    },
  };

  /* ============================================
     INIT
     ============================================ */
  function init() {
    CyberParticles.init();
    EntrySystem.init();
    SidebarNav.init();
    ScrollReveal.init();
    CounterAnimation.init();
    Modal.init();
    ContactForm.init();
    Toast.init();
    SecretAdmin.init();
    GlitchEffect.init();
    Visualizer.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for submodules
  window.Toast = Toast;
  window.CounterAnimation = CounterAnimation;
})();
