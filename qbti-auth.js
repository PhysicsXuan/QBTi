/* ============================================================
   QAuth —— QBTI 登录/注册系统（对接后端验证码）
   使用方式：<script src="qbti-auth.js"></script>
   暴露全局：window.QAuth
   ============================================================ */
(function(){
  'use strict';

  const USERS_KEY   = 'qbti_users_v1';
  const SESSION_KEY = 'qbti_session_v1';
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
  const CODE_COOLDOWN = 60 * 1000;
  const API_BASE = '';

  let currentUser = null;
  let codeTimer = null;
  let listeners = [];
  let injected = false;

  function cyrb53(str, seed){
    seed = seed || 0;
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++){
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function hashPassword(pw, salt){
    return cyrb53(cyrb53(pw + ':' + salt) + ':' + salt + ':' + pw.length);
  }
  function genSalt(){
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function escapeHTML(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatTime(ts){
    const d = new Date(ts);
    const pad = n => n < 10 ? '0'+n : ''+n;
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function loadUsers(){
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e){ return []; }
  }
  function saveUsers(users){
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch(e){}
  }
  function findUser(identifier){
    const users = loadUsers();
    const id = String(identifier).trim().toLowerCase();
    if(!id) return null;
    return users.find(u =>
      u.email.toLowerCase() === id ||
      u.username.toLowerCase() === id
    ) || null;
  }
  function findUserByEmail(email){
    const users = loadUsers();
    const id = String(email).trim().toLowerCase();
    return users.find(u => u.email.toLowerCase() === id) || null;
  }
  function findUserByPhone(phone){
    const users = loadUsers();
    const id = String(phone).trim();
    return users.find(u => u.phone === id) || null;
  }

  function loadSession(){
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !s.email || !s.expiresAt) return null;
      if(Date.now() > s.expiresAt){
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch(e){ return null; }
  }
  function saveSession(email){
    const s = {
      email: email,
      loginAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      token: Math.random().toString(36).slice(2) + Date.now().toString(36)
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch(e){}
    return s;
  }
  function clearSession(){
    try { localStorage.removeItem(SESSION_KEY); } catch(e){}
  }

  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_PHONE = /^1[3-9]\d{9}$/;
  const RE_USERNAME = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;

  function validateRegister(data){
    const errs = {};
    if(!RE_EMAIL.test(data.email)) errs.email = '邮箱格式不正确';
    if(!RE_PHONE.test(data.phone)) errs.phone = '请输入 11 位中国大陆手机号';
    if(!data.code || data.code.length !== 6) errs.code = '请输入 6 位验证码';
    if(!RE_USERNAME.test(data.username)) errs.username = '用户名 2-20 位（字母/数字/下划线/中文）';
    if(!data.password || data.password.length < 6) errs.password = '密码至少 6 位';
    if(data.password !== data.confirm) errs.confirm = '两次密码不一致';
    return errs;
  }

  function toast(msg, type){
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'qauth-toast qauth-toast-' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function emitChange(){
    const info = {
      isLoggedIn: !!currentUser,
      user: currentUser ? Object.assign({}, currentUser) : null
    };
    listeners.forEach(fn => { try { fn(info); } catch(e){} });
  }

  function publicUser(u){
    if(!u) return null;
    return { email: u.email, phone: u.phone, username: u.username, createdAt: u.createdAt };
  }

  function injectStyles(){
    if(document.getElementById('qauthStyles')) return;
    const style = document.createElement('style');
    style.id = 'qauthStyles';
    style.textContent = `
.qauth-mask{position:fixed;inset:0;z-index:300;background:rgba(3,4,12,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}
.qauth-mask.show{display:flex;animation:qauthFadeIn .22s ease-out;}
@keyframes qauthFadeIn{from{opacity:0}to{opacity:1}}
.qauth-modal{width:100%;max-width:440px;background:#0B0D1C;border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:32px 28px;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.6);animation:qauthSlideUp .28s cubic-bezier(.2,.9,.3,1.2);max-height:90vh;overflow-y:auto;}
@keyframes qauthSlideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.qauth-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.55);font-size:18px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:.2s;font-family:inherit;padding:0;}
.qauth-close:hover{color:#fff;border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.08)}
.qauth-tabs{display:flex;gap:6px;margin-bottom:24px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px;}
.qauth-tabs button{flex:1;padding:9px 0;border-radius:9px;border:0;background:transparent;color:rgba(255,255,255,.45);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-tabs button:hover{color:rgba(255,255,255,.75)}
.qauth-tabs button.active{background:var(--q-color,rgb(255,138,72));color:#fff;box-shadow:0 4px 16px rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.35);}
.qauth-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:.02em;}
.qauth-subtitle{font-size:12.5px;color:var(--muted,#8B90B8);margin-bottom:22px;line-height:1.6;}
.qauth-field{margin-bottom:14px;}
.qauth-field label{display:block;font-size:12px;color:var(--muted,#8B90B8);margin-bottom:7px;font-weight:500;}
.qauth-field input{width:100%;padding:12px 14px;border-radius:11px;font-size:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:var(--txt,#E9EBFF);font-family:inherit;outline:none;transition:.2s;}
.qauth-field input:focus{border-color:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.7);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.05);}
.qauth-field input.err{border-color:rgba(235,65,75,.7);background:rgba(235,65,75,.06);}
.qauth-field .qauth-err{font-size:11.5px;color:#FF8FA0;margin-top:5px;display:none;}
.qauth-field.has-err .qauth-err{display:block;}
.qauth-code-row{display:flex;gap:10px;}
.qauth-code-row input{flex:1;min-width:0;}
.qauth-send-code{padding:0 16px;border-radius:11px;border:1px solid rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.1);color:var(--q-color,rgb(255,138,72));font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;transition:.2s;}
.qauth-send-code:hover:not(:disabled){background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.2);color:#fff;}
.qauth-send-code:disabled{opacity:.45;cursor:not-allowed;border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.4);}
.qauth-submit{width:100%;padding:13px;border-radius:12px;border:0;background:var(--q-color,rgb(255,138,72));color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:10px;box-shadow:0 8px 24px rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.32);transition:.2s;}
.qauth-submit:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}
.qauth-submit:disabled{opacity:.55;cursor:not-allowed;transform:none}
.qauth-switch{margin-top:16px;text-align:center;font-size:12.5px;color:var(--muted,#8B90B8);}
.qauth-switch a{color:var(--q-color,rgb(255,138,72));cursor:pointer;font-weight:600;text-decoration:none;}
.qauth-switch a:hover{text-decoration:underline}
.qauth-legal{font-size:11px;color:rgba(255,255,255,.35);margin-top:16px;line-height:1.7;text-align:center;}
.qauth-profile-row{display:flex;align-items:center;gap:14px;padding:14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:10px;}
.qauth-profile-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--q-color,rgb(255,138,72)),rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5));display:grid;place-items:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;}
.qauth-profile-info{flex:1;min-width:0}
.qauth-profile-name{font-size:15.5px;font-weight:700;color:#fff;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qauth-profile-meta{font-size:11.5px;color:var(--muted,#8B90B8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qauth-profile-detail{padding:14px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:16px;}
.qauth-profile-detail-row{display:flex;justify-content:space-between;padding:9px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05);}
.qauth-profile-detail-row:last-child{border-bottom:0}
.qauth-profile-detail-row .k{color:var(--muted,#8B90B8)}
.qauth-profile-detail-row .v{color:#fff;font-weight:600}
.qauth-logout-btn{width:100%;padding:11px;border-radius:11px;border:1px solid rgba(235,65,75,.35);background:rgba(235,65,75,.08);color:#FF8FA0;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-logout-btn:hover{background:rgba(235,65,75,.18);color:#FF6B7A;}
.qauth-btn{position:fixed;right:20px;bottom:124px;z-index:150;height:42px;padding:0 16px;border-radius:21px;border:1px solid rgba(255,255,255,.1);background:rgba(12,14,28,.85);color:var(--muted,#8B90B8);cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;font-family:inherit;transition:.25s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);white-space:nowrap;}
.qauth-btn:hover{color:var(--txt,#E9EBFF);border-color:var(--q-color,rgb(255,138,72));transform:translateY(-1px);}
.qauth-btn .qauth-btn-avatar{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--q-color,rgb(255,138,72)),rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5));display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;}
@media (max-width:600px){
  .qauth-btn{bottom:124px;right:20px;padding:0 13px;font-size:12px;}
  .qauth-modal{padding:26px 20px;border-radius:18px;}
  .qauth-title{font-size:19px;}
}
.qauth-toast{position:fixed;top:90px;left:50%;transform:translate(-50%,-14px);padding:11px 20px;border-radius:12px;font-size:13.5px;font-weight:600;color:#fff;z-index:400;background:#151A33;border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.5);pointer-events:none;opacity:0;transition:.28s cubic-bezier(.2,.9,.3,1.2);max-width:90vw;text-align:center;}
.qauth-toast.show{opacity:1;transform:translate(-50%,0)}
.qauth-toast-ok{border-color:rgba(80,220,140,.5);background:rgba(80,220,140,.14);color:#9EEBB8;}
.qauth-toast-err{border-color:rgba(235,65,75,.5);background:rgba(235,65,75,.14);color:#FFB4BE;}
.qauth-toast-info{border-color:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.14);color:var(--q-color,rgb(255,138,72));}
`;
    document.head.appendChild(style);
  }

  function buildModal(){
    const mask = document.createElement('div');
    mask.className = 'qauth-mask';
    mask.id = 'qauthMask';
    mask.innerHTML = `
      <div class="qauth-modal" id="qauthModal">
        <button class="qauth-close" type="button" aria-label="关闭">×</button>

        <div class="qauth-view" data-view="login" style="display:none;">
          <div class="qauth-tabs">
            <button type="button" data-tab="login" class="active">登录</button>
            <button type="button" data-tab="register">注册</button>
          </div>
          <h2 class="qauth-title">欢迎回来</h2>
          <p class="qauth-subtitle">用邮箱或用户名登录你的量子账户</p>
          <form class="qauth-form" data-form="login" autocomplete="on">
            <div class="qauth-field" data-name="identifier">
              <label>邮箱 / 用户名</label>
              <input name="identifier" type="text" placeholder="输入邮箱或用户名" autocomplete="username" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="password">
              <label>密码</label>
              <input name="password" type="password" placeholder="输入密码" autocomplete="current-password" />
              <div class="qauth-err"></div>
            </div>
            <button type="submit" class="qauth-submit">登录</button>
          </form>
          <div class="qauth-switch">还没有账户？<a data-switch="register">立即注册</a></div>
        </div>

        <div class="qauth-view" data-view="register" style="display:none;">
          <div class="qauth-tabs">
            <button type="button" data-tab="login">登录</button>
            <button type="button" data-tab="register" class="active">注册</button>
          </div>
          <h2 class="qauth-title">创建账户</h2>
          <p class="qauth-subtitle">填写以下信息，完成量子态绑定</p>
          <form class="qauth-form" data-form="register" autocomplete="on">
            <div class="qauth-field" data-name="email">
              <label>邮箱</label>
              <input name="email" type="email" placeholder="your@email.com" autocomplete="email" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="phone">
              <label>手机号</label>
              <input name="phone" type="tel" placeholder="11 位中国大陆手机号" autocomplete="tel" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="code">
              <label>验证码</label>
              <div class="qauth-code-row">
                <input name="code" type="text" placeholder="6 位验证码" inputmode="numeric" maxlength="6" />
                <button type="button" class="qauth-send-code" data-action="send-code">发送验证码</button>
              </div>
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="username">
              <label>用户名</label>
              <input name="username" type="text" placeholder="2-20 位，字母/数字/下划线/中文" autocomplete="nickname" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="password">
              <label>密码</label>
              <input name="password" type="password" placeholder="至少 6 位" autocomplete="new-password" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="confirm">
              <label>确认密码</label>
              <input name="confirm" type="password" placeholder="再次输入密码" autocomplete="new-password" />
              <div class="qauth-err"></div>
            </div>
            <button type="submit" class="qauth-submit">创建账户</button>
          </form>
          <div class="qauth-switch">已有账户？<a data-switch="login">去登录</a></div>
          <div class="qauth-legal">注册即表示同意我们的服务条款与隐私政策</div>
        </div>

        <div class="qauth-view" data-view="profile" style="display:none;">
          <h2 class="qauth-title">我的账户</h2>
          <p class="qauth-subtitle">你的量子态身份信息</p>
          <div id="qauthProfileContent"></div>
          <button class="qauth-logout-btn" type="button" data-action="logout">退出登录</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);
    return mask;
  }

  function buildFloatBtn(){
    const btn = document.createElement('button');
    btn.className = 'qauth-btn';
    btn.id = 'qauthFloatBtn';
    btn.type = 'button';
    btn.innerHTML = '<span style="font-size:14px">🔐</span><span class="qauth-btn-label">登录 / 注册</span>';
    document.body.appendChild(btn);
    return btn;
  }

  function showView(name){
    document.querySelectorAll('#qauthModal .qauth-view').forEach(v => {
      v.style.display = v.dataset.view === name ? '' : 'none';
    });
    if(name === 'profile') renderProfileContent();
    document.querySelectorAll('#qauthModal .qauth-field').forEach(f => {
      f.classList.remove('has-err');
      const inp = f.querySelector('input');
      if(inp) inp.classList.remove('err');
      const err = f.querySelector('.qauth-err');
      if(err) err.textContent = '';
    });
  }

  function openModal(view){
    injectStyles();
    if(!injected){
      buildModal();
      injectStyles();
      injected = true;
      bindModalEvents();
    }
    const mask = document.getElementById('qauthMask');
    mask.classList.add('show');
    if(currentUser) showView('profile');
    else showView(view || 'login');
  }

  function closeModal(){
    const mask = document.getElementById('qauthMask');
    if(mask) mask.classList.remove('show');
    if(codeTimer){ clearInterval(codeTimer); codeTimer = null; }
    const btn = document.querySelector('[data-action="send-code"]');
    if(btn){ btn.disabled = false; btn.textContent = '发送验证码'; }
  }

  function setFieldError(form, fieldName, msg){
    const field = form.querySelector('.qauth-field[data-name="' + fieldName + '"]');
    if(!field) return;
    const input = field.querySelector('input');
    const err = field.querySelector('.qauth-err');
    if(msg){
      field.classList.add('has-err');
      if(input) input.classList.add('err');
      if(err) err.textContent = msg;
    } else {
      field.classList.remove('has-err');
      if(input) input.classList.remove('err');
      if(err) err.textContent = '';
    }
  }
  function clearFormErrors(form){
    form.querySelectorAll('.qauth-field').forEach(f => {
      f.classList.remove('has-err');
      const inp = f.querySelector('input');
      if(inp) inp.classList.remove('err');
      const err = f.querySelector('.qauth-err');
      if(err) err.textContent = '';
    });
  }
  function getFormData(form){
    const data = {};
    form.querySelectorAll('input').forEach(inp => { data[inp.name] = inp.value.trim(); });
    return data;
  }

  function bindModalEvents(){
    const mask = document.getElementById('qauthMask');
    const modal = document.getElementById('qauthModal');
    modal.querySelector('.qauth-close').addEventListener('click', closeModal);
    mask.addEventListener('click', e => { if(e.target === mask) closeModal(); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && mask.classList.contains('show')) closeModal();
    });
    modal.querySelectorAll('.qauth-tabs button').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.tab));
    });
    modal.querySelectorAll('[data-switch]').forEach(a => {
      a.addEventListener('click', () => showView(a.dataset.switch));
    });
    const sendBtn = modal.querySelector('[data-action="send-code"]');
    if(sendBtn) sendBtn.addEventListener('click', handleSendCode);
    const loginForm = modal.querySelector('[data-form="login"]');
    loginForm.addEventListener('submit', handleLoginSubmit);
    const regForm = modal.querySelector('[data-form="register"]');
    regForm.addEventListener('submit', handleRegisterSubmit);
    const logoutBtn = modal.querySelector('[data-action="logout"]');
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  }

  async function handleSendCode(){
    const modal = document.getElementById('qauthModal');
    const form = modal.querySelector('[data-form="register"]');
    const data = getFormData(form);
    const sendBtn = modal.querySelector('[data-action="send-code"]');

    clearFormErrors(form);

    if(!RE_EMAIL.test(data.email)){
      setFieldError(form, 'email', '请先填写正确的邮箱');
      return;
    }
    if(!RE_PHONE.test(data.phone)){
      setFieldError(form, 'phone', '请先填写正确的手机号');
      return;
    }
    if(findUserByEmail(data.email)){
      setFieldError(form, 'email', '该邮箱已注册，请直接登录');
      return;
    }

    sendBtn.disabled = true;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = '发送中…';

    try {
      const res = await fetch(API_BASE + '/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, phone: data.phone }),
      });
      const result = await res.json();
      if(!res.ok || !result.success){
        setFieldError(form, 'code', result.error || '发送失败');
        toast(result.error || '发送失败', 'err');
        sendBtn.disabled = false;
        sendBtn.textContent = originalText;
        return;
      }
      toast(result.message || '验证码已发送', 'ok');
    } catch(err){
      console.error('[QAuth] 发送失败:', err);
      setFieldError(form, 'code', '无法连接服务器，请确认已启动 server.js');
      toast('无法连接服务器，请确认已启动 server.js', 'err');
      sendBtn.disabled = false;
      sendBtn.textContent = originalText;
      return;
    }

    let remaining = Math.floor(CODE_COOLDOWN / 1000);
    sendBtn.textContent = remaining + 's';
    if(codeTimer) clearInterval(codeTimer);
    codeTimer = setInterval(() => {
      remaining--;
      if(remaining <= 0){
        clearInterval(codeTimer);
        codeTimer = null;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
      } else {
        sendBtn.textContent = remaining + 's';
      }
    }, 1000);
  }

  async function handleRegisterSubmit(e){
    e.preventDefault();
    const modal = document.getElementById('qauthModal');
    const form = e.target;
    const data = getFormData(form);
    const submitBtn = form.querySelector('.qauth-submit');

    clearFormErrors(form);

    const errs = validateRegister(data);
    if(Object.keys(errs).length > 0){
      Object.keys(errs).forEach(k => setFieldError(form, k, errs[k]));
      toast('请检查表单填写', 'err');
      return;
    }

    if(findUserByEmail(data.email)){
      setFieldError(form, 'email', '该邮箱已被注册');
      return;
    }
    if(findUserByPhone(data.phone)){
      setFieldError(form, 'phone', '该手机号已被注册');
      return;
    }
    const users = loadUsers();
    if(users.some(u => u.username.toLowerCase() === data.username.toLowerCase())){
      setFieldError(form, 'username', '该用户名已被占用');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '验证中…';

    try {
      const res = await fetch(API_BASE + '/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, code: data.code }),
      });
      const result = await res.json();
      if(!res.ok || !result.success){
        setFieldError(form, 'code', result.error || '验证码不正确');
        submitBtn.disabled = false;
        submitBtn.textContent = '创建账户';
        return;
      }
    } catch(err){
      setFieldError(form, 'code', '无法连接服务器，请确认已启动 server.js');
      submitBtn.disabled = false;
      submitBtn.textContent = '创建账户';
      return;
    }

    submitBtn.textContent = '创建中…';

    setTimeout(() => {
      const salt = genSalt();
      const user = {
        email: data.email,
        emailLower: data.email.toLowerCase(),
        phone: data.phone,
        username: data.username,
        salt: salt,
        passwordHash: hashPassword(data.password, salt),
        createdAt: Date.now()
      };
      users.push(user);
      saveUsers(users);

      saveSession(user.email);
      currentUser = publicUser(user);

      submitBtn.disabled = false;
      submitBtn.textContent = '创建账户';

      toast('账户创建成功，已自动登录', 'ok');
      emitChange();

      setTimeout(() => { closeModal(); updateFloatButton(); }, 500);
    }, 320);
  }

  function handleLoginSubmit(e){
    e.preventDefault();
    const modal = document.getElementById('qauthModal');
    const form = e.target;
    const data = getFormData(form);
    const submitBtn = form.querySelector('.qauth-submit');

    clearFormErrors(form);

    if(!data.identifier){ setFieldError(form, 'identifier', '请输入邮箱或用户名'); return; }
    if(!data.password){ setFieldError(form, 'password', '请输入密码'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '登录中…';

    setTimeout(() => {
      const user = findUser(data.identifier);
      if(!user){
        setFieldError(form, 'identifier', '该账户不存在');
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
        return;
      }
      const hash = hashPassword(data.password, user.salt);
      if(hash !== user.passwordHash){
        setFieldError(form, 'password', '密码不正确');
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
        return;
      }

      saveSession(user.email);
      currentUser = publicUser(user);

      submitBtn.disabled = false;
      submitBtn.textContent = '登录';

      toast('欢迎回来，' + user.username, 'ok');
      emitChange();

      setTimeout(() => { closeModal(); updateFloatButton(); }, 500);
    }, 320);
  }

  function handleLogout(){
    clearSession();
    currentUser = null;
    toast('已退出登录', 'info');
    emitChange();
    closeModal();
    updateFloatButton();
  }

  function renderProfileContent(){
    const wrap = document.getElementById('qauthProfileContent');
    if(!wrap) return;
    if(!currentUser){
      wrap.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">未登录</p>';
      return;
    }
    const initial = (currentUser.username || '?').slice(0, 1).toUpperCase();
    wrap.innerHTML = `
      <div class="qauth-profile-row">
        <div class="qauth-profile-avatar">${escapeHTML(initial)}</div>
        <div class="qauth-profile-info">
          <div class="qauth-profile-name">${escapeHTML(currentUser.username)}</div>
          <div class="qauth-profile-meta">${escapeHTML(currentUser.email)}</div>
        </div>
      </div>
      <div class="qauth-profile-detail">
        <div class="qauth-profile-detail-row"><span class="k">邮箱</span><span class="v">${escapeHTML(currentUser.email)}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">手机号</span><span class="v">${escapeHTML(currentUser.phone)}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">用户名</span><span class="v">${escapeHTML(currentUser.username)}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">注册时间</span><span class="v">${formatTime(currentUser.createdAt)}</span></div>
      </div>
    `;
  }

  function updateFloatButton(){
    const btn = document.getElementById('qauthFloatBtn');
    if(!btn) return;
    if(currentUser){
      const initial = (currentUser.username || '?').slice(0, 1).toUpperCase();
      btn.innerHTML = '<span class="qauth-btn-avatar">' + escapeHTML(initial) + '</span>'
        + '<span class="qauth-btn-label">' + escapeHTML(currentUser.username) + '</span>';
    } else {
      btn.innerHTML = '<span style="font-size:14px">🔐</span><span class="qauth-btn-label">登录 / 注册</span>';
    }
  }

  function init(){
    injectStyles();

    const session = loadSession();
    if(session){
      const user = findUserByEmail(session.email);
      if(user) currentUser = publicUser(user);
      else clearSession();
    }

    if(!document.getElementById('qauthFloatBtn')) buildFloatBtn();

    const floatBtn = document.getElementById('qauthFloatBtn');
    if(!floatBtn._qauthBound){
      floatBtn._qauthBound = true;
      floatBtn.addEventListener('click', function(){
        if(currentUser) openModal('profile');
        else openModal('login');
      });
    }

    updateFloatButton();
    console.log('[QAuth] 已初始化，登录状态:', !!currentUser);
    setTimeout(function(){ emitChange(); }, 0);
  }

  const api = {
    getCurrentUser: function(){ return currentUser ? Object.assign({}, currentUser) : null; },
    isLoggedIn: function(){ return !!currentUser; },
    logout: function(){ handleLogout(); },
    onChange: function(fn){
      if(typeof fn !== 'function') return function(){};
      listeners.push(fn);
      setTimeout(() => {
        try {
          fn({ isLoggedIn: !!currentUser, user: currentUser ? Object.assign({}, currentUser) : null });
        } catch(e){}
      }, 0);
      return function(){ listeners = listeners.filter(f => f !== fn); };
    },
    openLogin: function(){ openModal('login'); },
    openRegister: function(){ openModal('register'); },
    openProfile: function(){ openModal('profile'); },
    requireLogin: function(){
      if(currentUser) return true;
      openModal('login');
      toast('请先登录', 'info');
      return false;
    }
  };

  window.QAuth = api;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();