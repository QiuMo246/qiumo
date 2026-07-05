/* ============================================
   秋末 — Personal Developer Website
   Main Script — Modular Architecture
   ============================================ */

;(function () {
  'use strict';

  /* ============================================
     UTILITIES
     ============================================ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

  /* ============================================
     MODULE: Particle Canvas (Hero Background)
     ============================================ */
  const ParticleCanvas = {
    canvas: null,
    ctx: null,
    particles: [],
    mouse: { x: 0, y: 0 },
    animFrame: null,
    observer: null,

    init() {
      this.canvas = $('#heroCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      this.createParticles();
      this.bindEvents();
      this.observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            if (!ParticleCanvas.animFrame) ParticleCanvas.animate();
          } else {
            if (ParticleCanvas.animFrame) {
              cancelAnimationFrame(ParticleCanvas.animFrame);
              ParticleCanvas.animFrame = null;
            }
          }
        });
      }, { threshold: 0 });
      this.observer.observe(this.canvas.parentElement);
    },

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.w = rect.width;
      this.h = rect.height;
    },

    createParticles() {
      this.particles = [];
      const count = Math.min(80, Math.floor((this.w * this.h) / 15000));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }
    },

    bindEvents() {
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.resize();
          this.createParticles();
        }, 200);
      });

      this.canvas.parentElement.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      });
    },

    draw() {
      this.ctx.clearRect(0, 0, this.w, this.h);

      // Draw connections
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.12;
            this.ctx.beginPath();
            this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
            this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
            this.ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of this.particles) {
        // Mouse repel
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.8;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -10) p.x = this.w + 10;
        if (p.x > this.w + 10) p.x = -10;
        if (p.y < -10) p.y = this.h + 10;
        if (p.y > this.h + 10) p.y = -10;

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(168, 150, 255, ${p.opacity})`;
        this.ctx.fill();
      }
    },

    animate() {
      this.draw();
      this.animFrame = requestAnimationFrame(() => this.animate());
    },
  };

  /* ============================================
     MODULE: Typing Animation (Hero Role)
     ============================================ */
  const TypingEffect = {
    roles: [
      '前端开发者',
      '独立创作者',
      'UI 设计师',
      '创意工程师',
    ],
    el: null,
    roleIndex: 0,
    charIndex: 0,
    isDeleting: false,
    timeout: null,

    init() {
      this.el = $('#heroRole');
      if (!this.el) return;
      this.type();
    },

    type() {
      const currentRole = this.roles[this.roleIndex];
      if (this.isDeleting) {
        this.charIndex--;
      } else {
        this.charIndex++;
      }

      this.el.textContent = currentRole.substring(0, this.charIndex);

      let delay = this.isDeleting ? 50 : 100;

      if (!this.isDeleting && this.charIndex === currentRole.length) {
        delay = 2500;
        this.isDeleting = true;
      } else if (this.isDeleting && this.charIndex === 0) {
        this.isDeleting = false;
        this.roleIndex = (this.roleIndex + 1) % this.roles.length;
        delay = 400;
      }

      this.timeout = setTimeout(() => this.type(), delay);
    },
  };

  /* ============================================
     MODULE: Cursor Glow (Desktop Parallax)
     ============================================ */
  const CursorGlow = {
    el: null,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,

    init() {
      this.el = $('#cursorGlow');
      if (!this.el || window.matchMedia('(max-width: 768px)').matches) return;

      document.addEventListener('mousemove', (e) => {
        this.targetX = e.clientX;
        this.targetY = e.clientY;
        this.el.classList.add('active');
      });

      document.addEventListener('mouseleave', () => {
        this.el.classList.remove('active');
      });

      this.animate();
    },

    animate() {
      this.currentX = lerp(this.currentX, this.targetX, 0.08);
      this.currentY = lerp(this.currentY, this.targetY, 0.08);
      this.el.style.left = this.currentX + 'px';
      this.el.style.top = this.currentY + 'px';
      requestAnimationFrame(() => this.animate());
    },
  };

  /* ============================================
     MODULE: Navigation
     ============================================ */
  const Navigation = {
    nav: null,
    toggle: null,
    menu: null,
    links: [],
    sections: [],
    isOpen: false,

    init() {
      this.nav = $('#nav');
      this.toggle = $('#navToggle');
      this.menu = $('#mobileMenu');
      this.links = $$('.nav-link');
      this.mobileLinks = $$('.mobile-link');
      this.sections = $$('.section, .hero');

      this.bindScroll();
      this.bindToggle();
      this.bindLinks();
      this.highlightActive();
    },

    bindScroll() {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            this.onScroll();
            ticking = false;
          });
          ticking = true;
        }
      });
    },

    onScroll() {
      const scrollY = window.scrollY;

      // Nav background
      if (scrollY > 50) {
        this.nav.classList.add('scrolled');
      } else {
        this.nav.classList.remove('scrolled');
      }

      this.highlightActive();
    },

    highlightActive() {
      const scrollY = window.scrollY + window.innerHeight * 0.35;
      let current = '';

      this.sections.forEach((section) => {
        if (section.offsetTop <= scrollY) {
          current = section.getAttribute('id');
        }
      });

      this.links.forEach((link) => {
        link.classList.toggle('active', link.dataset.section === current);
      });
    },

    bindToggle() {
      this.toggle.addEventListener('click', () => {
        this.isOpen = !this.isOpen;
        this.toggle.classList.toggle('open', this.isOpen);
        this.menu.classList.toggle('open', this.isOpen);
        document.body.style.overflow = this.isOpen ? 'hidden' : '';
      });
    },

    bindLinks() {
      const close = () => {
        if (this.isOpen) {
          this.isOpen = false;
          this.toggle.classList.remove('open');
          this.menu.classList.remove('open');
          document.body.style.overflow = '';
        }
      };

      this.mobileLinks.forEach((link) => link.addEventListener('click', close));

      // Close on ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });
    },
  };

  /* ============================================
     MODULE: Scroll Reveal (IntersectionObserver)
     ============================================ */
  const ScrollReveal = {
    init() {
      const els = $$('.reveal-up, .reveal-left, .reveal-right, .section-label, .section-desc');
      if (!els.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
      );

      els.forEach((el) => observer.observe(el));
    },
  };

  /* ============================================
     MODULE: Counter Animation (About Stats)
     ============================================ */
  const CounterAnimation = {
    init() {
      const counters = $$('.stat-number');
      if (!counters.length) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.animateCounter(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      counters.forEach((el) => observer.observe(el));
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
     MODULE: 3D Card Tilt (Projects)
     ============================================ */
  const CardTilt = {
    init() {
      const cards = $$('.project-card');
      if (!cards.length || window.matchMedia('(max-width: 768px)').matches) return;

      cards.forEach((card) => {
        const inner = $('.project-card-inner', card);

        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -8;
          const rotateY = ((x - centerX) / centerX) * 8;

          inner.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
        });

        card.addEventListener('mouseleave', () => {
          inner.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
      });
    },
  };

  /* ============================================
     MODULE: Ripple Effect (Buttons)
     ============================================ */
  const RippleEffect = {
    init() {
      $$('.btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const ripple = document.createElement('span');
          ripple.classList.add('ripple');
          const rect = btn.getBoundingClientRect();
          const size = Math.max(rect.width, rect.height);
          ripple.style.width = ripple.style.height = size + 'px';
          ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
          ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
          btn.appendChild(ripple);
          ripple.addEventListener('animationend', () => ripple.remove());
        });
      });
    },
  };

  /* ============================================
     MODULE: Modal System
     ============================================ */
  const ProjectData = {
    1: {
      title: 'Antigravity',
      subtitle: 'OpenCode 专用第三方插件',
      description: `这是一款 OpenCode 专用第三方插件，不用 API 密钥，直接用谷歌账号 OAuth 登录谷歌 Antigravity 服务，就能在 OpenCode 里调用 Claude、Gemini 高端模型。多谷歌账号自动轮换，解决额度限流；
同时使用 Antigravity、Gemini CLI 两套免费额度；
支持模型深度思考、联网搜索、会话自动重试。`,
      tags: ['TypeScript', 'Shell', 'JavaScript'],
      github: 'https://github.com/NoeFabris/opencode-antigravity-auth',
    },

  
    2: {
      title: 'Artisan',
      subtitle: '免费的沉浸式氛围感音乐播放器',
      description: `Mineradio 是开发者 XxHuberrr 开源、基于 Electron 打造的沉浸式视觉向桌面音乐播放器，开源协议 GPL-3.0，全程无广告、无功能付费锁、无捆绑软件。
原版仅支持 Windows，社区开发者移植出 macOS（Intel/M 芯片双版）、安卓客户端，同时提供网页版，可浏览器直接打开体验，核心定位不是单纯听歌工具，而是带电影级动态视觉的私人音乐舞台。`,
      tags: ['HTML', 'JavaScript', 'NSIS'],
      github: 'https://github.com/XxHuberrr/Mineradio',
    },


    3: {
      title: 'blind_watermark',
      subtitle: '开源 Python 盲水印库',
      description: `blind_watermark 是国内开发者 guofei9987 开源的 Python 盲水印库，GitHub Star 过万，MIT 开源协议，是目前最易用、落地最多的图片隐形盲水印工具。
核心定义：盲水印（Blind Watermark），提取水印不需要原始无水印原图，只需要带水印图片 + 两组密钥即可解析，区别于普通水印、非盲水`,
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

      // Open
      $$('.project-view-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-modal');
          this.open(id);
        });
      });

      $$('.project-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-project');
          this.open(id);
        });
      });

      // Close
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
        <div class="modal-image">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="modal-desc">${data.description.split('\n\n').map(p => `<p style="margin-bottom:12px">${p}</p>`).join('')}</div>
        <div class="modal-tags">${data.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <a href="${data.github}" target="_blank" rel="noopener" class="modal-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
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
     MODULE: Contact Form
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
        Toast.show('消息发送成功！我会尽快回复你。', 'success');

        setTimeout(() => {
          this.form.reset();
          this.submitBtn.classList.remove('success');
          this.submitBtn.disabled = false;
        }, 2500);
      } catch (err) {
        this.submitBtn.classList.remove('loading');
        this.submitBtn.disabled = false;
        Toast.show('发送失败，请稍后重试', 'error');
      }
    },
  };

  /* ============================================
     MODULE: Toast Notification
     ============================================ */
  const Toast = {
    container: null,

    init() {
      this.container = $('#toastContainer');
    },

    show(message, type = 'success') {
      const toast = document.createElement('div');
      toast.classList.add('toast');
      toast.style.position = 'relative';
      toast.innerHTML = `
        <div class="toast-icon ${type}">
          ${type === 'success'
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
          }
        </div>
        <span class="toast-text">${message}</span>
        <div class="toast-progress"></div>
      `;

      this.container.appendChild(toast);

      // Trigger show animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.classList.add('show');
        });
      });

      // Remove after animation
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }, 3500);
    },
  };

  /* ============================================
     MODULE: Smooth Scroll (enhanced)
     ============================================ */
  const SmoothScroll = {
    init() {
      $$('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href');
          if (href === '#') return;
          const target = $(href);
          if (!target) return;

          e.preventDefault();
          const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
          const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

          window.scrollTo({ top, behavior: 'smooth' });
        });
      });
    },
  };

  /* ============================================
     MODULE: Secret Admin (Double-click to reveal)
     ============================================ */
  const SecretAdmin = {
    element: null,
    section: null,
    isVisible: false,

    init() {
      this.element = $('.hero-name');
      this.section = $('#admin');
      if (!this.element || !this.section) return;
      this.bindTrigger();
    },

    bindTrigger() {
      this.element.addEventListener('dblclick', (e) => {
        if (this.isVisible) return;
        this.isVisible = true;
        this.section.style.display = 'block';
        const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'));
        const top = this.section.getBoundingClientRect().top + window.scrollY - navHeight - 20;
        window.scrollTo({ top, behavior: 'smooth' });
        if (window.Toast) {
          window.Toast.show('管理面板已开启', 'success');
        }
      });
    },
  };

  /* ============================================
     MODULE: Scroll Progress Bar
     ============================================ */
  const ScrollProgress = {
    bar: null,
    init() {
      this.bar = document.createElement('div');
      this.bar.className = 'scroll-progress';
      document.body.prepend(this.bar);
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
      this.onScroll();
    },
    onScroll() {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      this.bar.style.transform = `scaleX(${pct / 100})`;
    },
  };

  /* ============================================
     MODULE: Back to Top
     ============================================ */
  const BackToTop = {
    btn: null,

    init() {
      this.btn = $('#backToTop');
      if (!this.btn) return;
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
      this.btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      this.onScroll();
    },

    onScroll() {
      if (window.scrollY > 400) {
        this.btn.classList.add('visible');
      } else {
        this.btn.classList.remove('visible');
      }
    },
  };

  /* ============================================
     MODULE: Hero Parallax
     ============================================ */
  const HeroParallax = {
    init() {
      this.hero = $('#hero');
      this.content = $('.hero-content');
      this.canvas = $('#heroCanvas');
      if (!this.hero) return;
      window.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    },
    onScroll() {
      const st = window.scrollY;
      const heroH = this.hero.offsetHeight;
      if (st > heroH) return;
      const pct = st / heroH;
      if (this.content) this.content.style.transform = `translateY(${pct * 40}px)`;
      if (this.canvas) this.canvas.style.transform = `translateY(${pct * -20}px)`;
    },
  };

  /* ============================================
     INITIALIZE ALL MODULES
     ============================================ */
  function init() {
    ParticleCanvas.init();
    TypingEffect.init();
    CursorGlow.init();
    Navigation.init();
    ScrollReveal.init();
    CounterAnimation.init();
    ScrollProgress.init();
    BackToTop.init();
    HeroParallax.init();
    CardTilt.init();
    RippleEffect.init();
    Modal.init();
    ContactForm.init();
    Toast.init();
    SmoothScroll.init();
    SecretAdmin.init();
    if (window.Blog) window.Blog.init();
    if (window.Admin) window.Admin.init();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
