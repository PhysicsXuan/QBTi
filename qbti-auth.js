/* ============================================================
   QAuth —— QBTI 学生登录/注册/绑定家长 (含二维码生成 + 忘记密码 + 管理员)
   修复：ensureAdminUser 每次强制同步 Administrator / admin123456
   调整：右下角登录按钮 bottom 124px → 176px，避让设置按钮
   ============================================================ */
(function(){
  'use strict';

  const USERS_KEY   = 'qbti_users_v1';
  const SESSION_KEY = 'qbti_session_v1';
  const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
  const CODE_COOLDOWN = 60 * 1000;
  const API_BASE = '';

  /* Render/反向代理冷启动时 502/503/504 很常见：登录请求短暂重试，避免用户误以为账号坏了 */
  async function fetchWithBootstrapRetry(url, options, attempts){
    const max = attempts || 3;
    let lastError = null;
    for(let i = 0; i < max; i++){
      try {
        const res = await fetch(url, options);
        if((res.status === 502 || res.status === 503 || res.status === 504) && i < max - 1){
          await new Promise(resolve => setTimeout(resolve, 700 * (i + 1)));
          continue;
        }
        return res;
      } catch(err){
        lastError = err;
        if(i < max - 1) await new Promise(resolve => setTimeout(resolve, 700 * (i + 1)));
      }
    }
    throw lastError || new Error('NETWORK');
  }

  const ADMIN_USERNAME = 'Administrator';
  const ADMIN_PASSWORD = 'admin123456';
  const ADMIN_EMAIL    = 'administrator@qbti.local';

  let currentUser = null;
  let adminToken = null;
  let syncToken = null;
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
  function genSalt(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
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
    try { const raw = localStorage.getItem(USERS_KEY); return raw ? JSON.parse(raw) : []; }
    catch(e){ return []; }
  }
  function saveUsers(users){
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch(e){}
  }
  function findUser(identifier){
    const users = loadUsers();
    const id = String(identifier).trim().toLowerCase();
    if(!id) return null;
    return users.find(u =>
      (u.email && u.email.toLowerCase() === id) ||
      (u.username && u.username.toLowerCase() === id)
    ) || null;
  }
  function findUserByEmail(email){
    const users = loadUsers();
    const id = String(email).trim().toLowerCase();
    return users.find(u => u.email && u.email.toLowerCase() === id) || null;
  }
  function findUserByPhone(phone){
    const users = loadUsers();
    const id = String(phone).trim();
    return users.find(u => u.phone === id) || null;
  }

  /* 服务器登录成功后的本地缓存：只用于刷新后恢复会话，不再用于校验密码 */
  function cacheServerUser(user){
    if(!user || !user.email) return null;
    const users = loadUsers();
    const emailLower = String(user.email).toLowerCase();
    const idx = users.findIndex(u => u.email && u.email.toLowerCase() === emailLower);
    const cached = {
      email: user.email,
      emailLower: emailLower,
      phone: user.phone || '',
      username: user.username || '',
      createdAt: user.createdAt || Date.now(),
      role: 'student',
      server: true
    };
    if(idx >= 0){
      users[idx] = Object.assign({}, users[idx], cached);
    } else {
      users.push(cached);
    }
    saveUsers(users);
    return cached;
  }

  function cacheAdminUser(user){
    if(!user || !user.email) return null;
    const users = loadUsers();
    const emailLower = String(user.email).toLowerCase();
    const idx = users.findIndex(u => u.email && u.email.toLowerCase() === emailLower);
    const cached = {
      email: user.email,
      emailLower: emailLower,
      phone: user.phone || '',
      username: user.username || 'Administrator',
      createdAt: user.createdAt || Date.now(),
      role: 'admin',
      server: true
    };
    if(idx >= 0) users[idx] = Object.assign({}, users[idx], cached);
    else users.push(cached);
    saveUsers(users);
    return cached;
  }

  async function checkAdminPolicy(){
    if(!currentUser || currentUser.role !== 'admin') return true;
    if(!adminToken) return false;
    try {
      const res = await fetch(API_BASE + '/api/admin/policy', {
        headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      if(res.ok) return true;
      const d = await res.json().catch(() => ({}));
      adminToken = null;
      clearSession();
      currentUser = null;
      toast(d.error || '学生端管理员权限已被收回', 'err');
      emitChange();
      return false;
    } catch(e){
      /* 网络异常时保留本地会话；策略变更会在下次校验时生效 */
      return true;
    }
  }

  function ensureAdminUser(){
    const users = loadUsers();
    const newSalt = genSalt();
    const newHash = hashPassword(ADMIN_PASSWORD, newSalt);

    let idx = users.findIndex(u =>
      u.username && String(u.username).toLowerCase() === ADMIN_USERNAME.toLowerCase()
    );
    if(idx < 0){
      idx = users.findIndex(u =>
        u.email && String(u.email).toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
    }

    if(idx >= 0){
      const u = users[idx];
      u.username = ADMIN_USERNAME;
      u.role = 'admin';
      u.builtin = true;
      u.salt = newSalt;
      u.passwordHash = newHash;
      if(!u.email){ u.email = ADMIN_EMAIL; }
      u.emailLower = String(u.email).toLowerCase();
      if(!u.createdAt) u.createdAt = Date.now();
      if(u.phone == null) u.phone = '';
      saveUsers(users);
      console.log('[QAuth] 已同步内置管理员：' + ADMIN_USERNAME + ' / ' + ADMIN_PASSWORD + '（role=admin）');
      return;
    }

    users.push({
      email: ADMIN_EMAIL,
      emailLower: ADMIN_EMAIL,
      phone: '',
      username: ADMIN_USERNAME,
      salt: newSalt,
      passwordHash: newHash,
      createdAt: Date.now(),
      role: 'admin',
      builtin: true
    });
    saveUsers(users);
    console.log('[QAuth] 已创建内置管理员：' + ADMIN_USERNAME + ' / ' + ADMIN_PASSWORD);
  }

  function loadSession(){
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !s.email || !s.expiresAt) return null;
      if(Date.now() > s.expiresAt){ localStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch(e){ return null; }
  }
  function saveSession(email, extra){
    const s = Object.assign({ email, loginAt: Date.now(), expiresAt: Date.now() + SESSION_DURATION,
      token: Math.random().toString(36).slice(2) + Date.now().toString(36) }, extra || {});
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch(e){}
    return s;
  }
  function clearSession(){
    try { localStorage.removeItem(SESSION_KEY); } catch(e){}
  }

  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_PHONE = /^1[3-9]\d{9}$/;
  const RE_USERNAME = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;

  function toast(msg, type){
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'qauth-toast qauth-toast-' + type;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  function emitChange(){
    const info = { isLoggedIn: !!currentUser, user: currentUser ? Object.assign({}, currentUser) : null };
    listeners.forEach(fn => { try { fn(info); } catch(e){} });
  }

  function publicUser(u){
    if(!u) return null;
    const isAdmin = u.role === 'admin' ||
      (u.username && String(u.username).toLowerCase() === ADMIN_USERNAME.toLowerCase());
    return {
      email: u.email,
      phone: u.phone,
      username: u.username,
      createdAt: u.createdAt,
      role: isAdmin ? 'admin' : 'student'
    };
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
.qauth-tabs button.active{background:var(--q-color,rgb(255,138,72));color:#fff;box-shadow:0 4px 16px rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.35);}
.qauth-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;}
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
.qauth-danger-zone{margin-top:18px;padding-top:14px;border-top:1px dashed rgba(235,65,75,.2);}
.qauth-delete-account-btn{width:100%;padding:11px;border-radius:11px;border:1px solid rgba(235,65,75,.4);background:rgba(235,65,75,.07);color:#FF8FA0;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-delete-account-btn:hover{background:rgba(235,65,75,.16);color:#FF6B7A;}
.qauth-delete-mask{position:fixed;inset:0;z-index:350;background:rgba(3,4,12,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}
.qauth-delete-modal{width:100%;max-width:440px;background:#0B0D1C;border:1px solid rgba(235,65,75,.3);border-radius:18px;padding:26px 24px;box-shadow:0 24px 60px rgba(0,0,0,.6);}
.qauth-delete-modal h3{font-size:19px;color:#fff;font-weight:800;margin-bottom:8px;}
.qauth-delete-modal p{font-size:12.5px;color:var(--muted,#8B90B8);line-height:1.8;margin-bottom:16px;}
.qauth-delete-modal .qauth-field{margin-bottom:14px;}
.qauth-delete-check{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#C9CEEE;line-height:1.6;margin:6px 0 16px;cursor:pointer;}
.qauth-delete-check input{margin-top:2px;accent-color:#EB414B;}
.qauth-delete-actions{display:flex;gap:10px;}
.qauth-delete-actions button{flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#C9CEEE;}
.qauth-delete-actions .danger{border-color:rgba(235,65,75,.5);background:rgba(235,65,75,.12);color:#FF8FA0;}
.qauth-delete-actions .danger:disabled{opacity:.4;cursor:not-allowed;}
.qauth-delete-err{font-size:12px;color:#FF8FA0;min-height:16px;margin-top:10px;line-height:1.6;}
/* ★ bottom 从 124px → 176px，避让新增的 settings 按钮 */
.qauth-btn{position:fixed;right:20px;bottom:176px;z-index:150;height:42px;padding:0 16px;border-radius:21px;border:1px solid rgba(255,255,255,.1);background:rgba(12,14,28,.85);color:var(--muted,#8B90B8);cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;font-family:inherit;transition:.25s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);white-space:nowrap;}
.qauth-btn:hover{color:var(--txt,#E9EBFF);border-color:var(--q-color,rgb(255,138,72));transform:translateY(-1px);}
.qauth-btn .qauth-btn-avatar{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--q-color,rgb(255,138,72)),rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5));display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;}
@media (max-width:600px){
  .qauth-btn{bottom:176px;right:20px;padding:0 13px;font-size:12px;}
  .qauth-modal{padding:26px 20px;border-radius:18px;}
  .qauth-title{font-size:19px;}
}
.qauth-toast{position:fixed;top:90px;left:50%;transform:translate(-50%,-14px);padding:11px 20px;border-radius:12px;font-size:13.5px;font-weight:600;color:#fff;z-index:400;background:#151A33;border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.5);pointer-events:none;opacity:0;transition:.28s cubic-bezier(.2,.9,.3,1.2);max-width:90vw;text-align:center;}
.qauth-toast.show{opacity:1;transform:translate(-50%,0)}
.qauth-toast-ok{border-color:rgba(80,220,140,.5);background:rgba(80,220,140,.14);color:#9EEBB8;}
.qauth-toast-err{border-color:rgba(235,65,75,.5);background:rgba(235,65,75,.14);color:#FFB4BE;}
.qauth-toast-info{border-color:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.14);color:var(--q-color,rgb(255,138,72));}
.qauth-bind-section{margin-top:20px;padding:18px;border-radius:14px;border:1px solid rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.25);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.05);}
.qauth-bind-title{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;font-weight:700;color:#fff;margin-bottom:12px;}
.qauth-bind-count{font-size:11.5px;color:var(--muted,#8B90B8);font-weight:500;}
.qauth-bind-empty{font-size:12.5px;color:var(--muted,#8B90B8);line-height:1.7;margin-bottom:12px;}
.qauth-bind-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);margin-bottom:8px;}
.qauth-bind-item-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#C77DFF,#7C5CFF);display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;}
.qauth-bind-item-info{flex:1;min-width:0;}
.qauth-bind-item-name{font-size:13px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qauth-bind-item-meta{font-size:11px;color:var(--muted,#8B90B8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qauth-bind-item-remove{border:0;background:transparent;color:rgba(255,255,255,.4);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:.2s;font-family:inherit;}
.qauth-bind-item-remove:hover{color:#FF8FA0;background:rgba(235,65,75,.12);}
.qauth-bind-actions{display:flex;gap:8px;margin-top:10px;}
.qauth-bind-gen-btn{flex:1;padding:10px;border-radius:10px;border:1px solid rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.5);background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.12);color:var(--q-color,rgb(255,138,72));font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-bind-gen-btn:hover:not(:disabled){background:rgba(var(--q-r,255),var(--q-g,138),var(--q-b,72),.22);color:#fff;}
.qauth-bind-gen-btn:disabled{opacity:.45;cursor:not-allowed;border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:rgba(255,255,255,.4);}
.qauth-bind-refresh-btn{padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:var(--muted,#8B90B8);font-size:13px;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-bind-refresh-btn:hover{color:#fff;background:rgba(255,255,255,.06);}
.qauth-invite-mask{position:fixed;inset:0;z-index:350;background:rgba(3,4,12,.88);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;}
.qauth-invite-card{width:100%;max-width:400px;padding:30px 26px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:#0B0D1C;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.6);}
.qauth-invite-kicker{font-size:11px;letter-spacing:.22em;color:var(--muted,#8B90B8);text-transform:uppercase;margin-bottom:14px;}
.qauth-invite-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:18px;}
.qauth-invite-code{font-size:40px;font-weight:800;letter-spacing:.24em;color:var(--q-color,rgb(255,138,72));margin:18px 0;user-select:all;font-family:ui-monospace,Menlo,monospace;}
.qauth-qrcode-wrap{margin:0 auto 20px;width:200px;height:200px;background:#fff;padding:10px;border-radius:12px;display:flex;align-items:center;justify-content:center;}
.qauth-invite-meta{font-size:12px;color:var(--muted,#8B90B8);line-height:1.7;margin-bottom:20px;}
.qauth-invite-actions{display:flex;gap:10px;flex-wrap:wrap;}
.qauth-invite-actions button{flex:1;min-width:120px;padding:11px;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;}
.qauth-invite-copy{background:var(--q-color,rgb(255,138,72));border:0;color:#fff;}
.qauth-invite-copy:hover{filter:brightness(1.1);}
.qauth-invite-close{background:transparent;border:1px solid rgba(255,255,255,.14);color:var(--muted,#8B90B8);}
.qauth-invite-close:hover{color:#fff;border-color:rgba(255,255,255,.28);}
.qauth-admin-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.1em;background:rgba(255,180,60,.15);color:#FFD98A;border:1px solid rgba(255,180,60,.35);margin-left:6px;}
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
          <div class="qauth-switch"><a data-switch="forgot">忘记密码？</a> · 还没有账户？<a data-switch="register">立即注册</a></div>
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
        </div>

        <div class="qauth-view" data-view="forgot" style="display:none;">
          <h2 class="qauth-title">重置密码</h2>
          <p class="qauth-subtitle">通过注册邮箱验证身份</p>
          <form class="qauth-form" data-form="forgot" autocomplete="on">
            <div class="qauth-field" data-name="email">
              <label>注册邮箱</label>
              <input name="email" type="email" placeholder="your@email.com" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="code">
              <label>验证码</label>
              <div class="qauth-code-row">
                <input name="code" type="text" placeholder="6 位验证码" inputmode="numeric" maxlength="6" />
                <button type="button" class="qauth-send-code" data-action="send-forgot-code">发送验证码</button>
              </div>
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="password">
              <label>新密码</label>
              <input name="password" type="password" placeholder="至少 6 位" />
              <div class="qauth-err"></div>
            </div>
            <div class="qauth-field" data-name="confirm">
              <label>确认新密码</label>
              <input name="confirm" type="password" placeholder="再次输入新密码" />
              <div class="qauth-err"></div>
            </div>
            <button type="submit" class="qauth-submit">重置密码</button>
          </form>
          <div class="qauth-switch"><a data-switch="login">返回登录</a></div>
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

  function prefillForgotEmail(email){
    const form = document.querySelector('#qauthModal [data-form="forgot"]');
    if(!form) return;
    const inp = form.querySelector('input[name="email"]');
    if(inp) inp.value = email || '';
  }

  function prefillLoginIdentifier(identifier){
    const form = document.querySelector('#qauthModal [data-form="login"]');
    if(!form) return;
    const inp = form.querySelector('input[name="identifier"]');
    if(inp) inp.value = identifier || '';
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
    const btn2 = document.querySelector('[data-action="send-forgot-code"]');
    if(btn2){ btn2.disabled = false; btn2.textContent = '发送验证码'; }
  }

  function setFieldError(form, fieldName, msg){
    const field = form.querySelector('.qauth-field[data-name="' + fieldName + '"]');
    if(!field) return;
    const input = field.querySelector('input');
    const err = field.querySelector('.qauth-err');
    if(msg){ field.classList.add('has-err'); if(input) input.classList.add('err'); if(err) err.textContent = msg; }
    else { field.classList.remove('has-err'); if(input) input.classList.remove('err'); if(err) err.textContent = ''; }
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

    const sendForgotBtn = modal.querySelector('[data-action="send-forgot-code"]');
    if(sendForgotBtn) sendForgotBtn.addEventListener('click', handleSendForgotCode);

    modal.querySelector('[data-form="login"]').addEventListener('submit', handleLoginSubmit);
    modal.querySelector('[data-form="register"]').addEventListener('submit', handleRegisterSubmit);
    modal.querySelector('[data-form="forgot"]').addEventListener('submit', handleForgotSubmit);

    const logoutBtn = modal.querySelector('[data-action="logout"]');
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  }

  async function handleSendForgotCode(){
    const form = document.querySelector('#qauthModal [data-form="forgot"]');
    const data = getFormData(form);
    const btn = document.querySelector('#qauthModal [data-action="send-forgot-code"]');
    clearFormErrors(form);

    if(!RE_EMAIL.test(data.email)){ setFieldError(form, 'email', '请先填写正确的邮箱'); return; }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '发送中…';

    try {
      const res = await fetch(API_BASE + '/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });
      const result = await res.json();
      if(!res.ok || !result.success){
        setFieldError(form, 'code', result.error || '发送失败');
        toast(result.error || '发送失败', 'err');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }
      toast(result.message || '验证码已发送', 'ok');
    } catch(err){
      setFieldError(form, 'code', '无法连接服务器');
      toast('无法连接服务器', 'err');
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }

    let remaining = Math.floor(CODE_COOLDOWN / 1000);
    btn.textContent = remaining + 's';
    if(codeTimer) clearInterval(codeTimer);
    codeTimer = setInterval(() => {
      remaining--;
      if(remaining <= 0){
        clearInterval(codeTimer);
        codeTimer = null;
        btn.disabled = false;
        btn.textContent = '发送验证码';
      } else {
        btn.textContent = remaining + 's';
      }
    }, 1000);
  }

  async function handleForgotSubmit(e){
    e.preventDefault();
    const form = e.target;
    const data = getFormData(form);
    const submitBtn = form.querySelector('.qauth-submit');
    clearFormErrors(form);

    if(!RE_EMAIL.test(data.email)){ setFieldError(form, 'email', '邮箱格式不正确'); return; }
    if(!data.code || data.code.length !== 6){ setFieldError(form, 'code', '请输入 6 位验证码'); return; }
    if(!data.password || data.password.length < 6){ setFieldError(form, 'password', '密码至少 6 位'); return; }
    if(data.password !== data.confirm){ setFieldError(form, 'confirm', '两次密码不一致'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '重置中…';

    try {
      const res = await fetch(API_BASE + '/api/student/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, code: data.code, newPassword: data.password })
      });
      const result = await res.json();
      if(!res.ok || !result.success){
        if(result.code === 'NOT_FOUND') setFieldError(form, 'email', result.error || '该邮箱未注册学生账号');
        else setFieldError(form, 'code', result.error || '重置失败');
        submitBtn.disabled = false;
        submitBtn.textContent = '重置密码';
        return;
      }
      toast('密码重置成功，请使用新密码登录', 'ok');
      showView('login');
      prefillLoginIdentifier(data.email);
    } catch(err){
      setFieldError(form, 'code', '无法连接服务器');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '重置密码';
    }
  }

  async function handleSendCode(){
    const modal = document.getElementById('qauthModal');
    const form = modal.querySelector('[data-form="register"]');
    const data = getFormData(form);
    const sendBtn = modal.querySelector('[data-action="send-code"]');
    clearFormErrors(form);

    if(!RE_EMAIL.test(data.email)){ setFieldError(form, 'email', '请先填写正确的邮箱'); return; }
    if(!RE_PHONE.test(data.phone)){ setFieldError(form, 'phone', '请先填写正确的手机号'); return; }

    sendBtn.disabled = true;
    const originalText = sendBtn.textContent;
    sendBtn.textContent = '发送中…';

    try {
      const checkRes = await fetch(API_BASE + '/api/check-email?email=' + encodeURIComponent(data.email) + '&role=student');
      const checkData = await checkRes.json();
      if (!checkData.available) {
         setFieldError(form, 'email', checkData.msg || '该邮箱已被占用');
         toast(checkData.msg || '该邮箱已被占用', 'err');
         sendBtn.disabled = false;
         sendBtn.textContent = originalText;
         return;
      }

      const res = await fetch(API_BASE + '/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, phone: data.phone })
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
      setFieldError(form, 'code', '无法连接服务器');
      toast('无法连接服务器', 'err');
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
    const form = e.target;
    const data = getFormData(form);
    const submitBtn = form.querySelector('.qauth-submit');
    clearFormErrors(form);

    const errs = {};
    if(!RE_EMAIL.test(data.email)) errs.email = '邮箱格式不正确';
    if(!RE_PHONE.test(data.phone)) errs.phone = '请输入 11 位中国大陆手机号';
    if(!data.code || data.code.length !== 6) errs.code = '请输入 6 位验证码';
    if(!RE_USERNAME.test(data.username)) errs.username = '用户名 2-20 位（字母/数字/下划线/中文）';
    if(!data.password || data.password.length < 6) errs.password = '密码至少 6 位';
    if(data.password !== data.confirm) errs.confirm = '两次密码不一致';
    if(Object.keys(errs).length > 0){
      Object.keys(errs).forEach(k => setFieldError(form, k, errs[k]));
      toast('请检查表单填写', 'err');
      return;
    }
    if(data.username.toLowerCase() === ADMIN_USERNAME.toLowerCase()){
      setFieldError(form, 'username', '该用户名为系统保留，不可注册');
      toast('该用户名不可用', 'err');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中…';

    try {
      const res = await fetch(API_BASE + '/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone,
          username: data.username,
          password: data.password,
          code: data.code
        })
      });
      const result = await res.json();
      if(!res.ok || !result.success){
        if(result.code === 'CODE_INVALID') setFieldError(form, 'code', result.error || '验证码不正确');
        else if(result.code === 'EMAIL_EXISTS' || result.code === 'PARENT_EMAIL') setFieldError(form, 'email', result.error || '该邮箱不可用');
        else if(result.code === 'USERNAME_TAKEN') setFieldError(form, 'username', result.error || '该用户名已被占用');
        else setFieldError(form, 'code', result.error || '注册失败');
        toast(result.error || '注册失败', 'err');
        submitBtn.disabled = false;
        submitBtn.textContent = '创建账户';
        return;
      }

      const user = cacheServerUser(result.user);
      if(!user) throw new Error('返回用户数据异常');
      saveSession(user.email, { syncToken: result.syncToken || null });
      syncToken = result.syncToken || null;
      currentUser = publicUser(user);
      submitBtn.disabled = false;
      submitBtn.textContent = '创建账户';
      toast('账户创建成功，已自动登录', 'ok');
      emitChange();
      setTimeout(() => { closeModal(); updateFloatButton(); }, 500);
    } catch(err){
      setFieldError(form, 'code', err && err.message === '返回用户数据异常' ? err.message : '无法连接服务器');
      toast('无法连接服务器', 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = '创建账户';
    }
  }

  async function handleLoginSubmit(e){
    e.preventDefault();
    const form = e.target;
    const data = getFormData(form);
    const submitBtn = form.querySelector('.qauth-submit');
    clearFormErrors(form);

    if(!data.identifier){ setFieldError(form, 'identifier', '请输入邮箱或用户名'); return; }
    if(!data.password){ setFieldError(form, 'password', '请输入密码'); return; }

    /* 学生端管理员：账号/密码/启用状态由家长端管理员控制 */
    const idLower = String(data.identifier || '').trim().toLowerCase();
    if(idLower === 'administrator' || idLower === 'administrator@qbti.local'){
      submitBtn.disabled = true;
      submitBtn.textContent = '登录中…';
      try {
        const res = await fetchWithBootstrapRetry(API_BASE + '/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Administrator', password: data.password })
        });
        const result = await res.json();
        if(!res.ok || !result.success){
          if(result.code === 'ADMIN_DISABLED') setFieldError(form, 'password', '学生端管理员已被家长端管理员停用');
          else setFieldError(form, 'password', result.error || '管理员登录失败');
          submitBtn.disabled = false;
          submitBtn.textContent = '登录';
          return;
        }
        const admin = Object.assign({}, result.user, { adminToken: result.token });
        cacheAdminUser(admin);
        adminToken = result.token;
        syncToken = result.syncToken || result.token;
        saveSession(admin.email, { adminToken: result.token, syncToken: syncToken });
        currentUser = publicUser(admin);
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
        toast('管理员已登录', 'ok');
        emitChange();
        setTimeout(() => { closeModal(); updateFloatButton(); }, 500);
      } catch(err){
        setFieldError(form, 'password', '无法连接服务器');
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '登录中…';

    try {
      const res = await fetchWithBootstrapRetry(API_BASE + '/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: data.identifier, password: data.password })
      });
      const result = await res.json();

      if(!res.ok || !result.success){
        if(result.code === 'NEED_PASSWORD_SETUP'){
          setFieldError(form, 'password', '该账号是旧版账号，请先通过“忘记密码”设置密码');
          toast('请用“忘记密码”设置一次密码', 'info');
          showView('forgot');
          if(data.identifier.indexOf('@') >= 0) prefillForgotEmail(data.identifier);
        } else if(result.code === 'AMBIGUOUS_USERNAME'){
          setFieldError(form, 'identifier', result.error || '请使用邮箱登录');
        } else if(res.status === 404){
          setFieldError(form, 'identifier', result.error || '账号不存在');
        } else {
          setFieldError(form, 'password', result.error || '登录失败');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
        return;
      }

      const user = cacheServerUser(result.user);
      if(!user) throw new Error('返回用户数据异常');
      saveSession(user.email, { syncToken: result.syncToken || null });
      syncToken = result.syncToken || null;
      currentUser = publicUser(user);
      submitBtn.disabled = false;
      submitBtn.textContent = '登录';
      toast('欢迎回来，' + (user.username || ''), 'ok');
      emitChange();
      setTimeout(() => { closeModal(); updateFloatButton(); }, 500);
    } catch(err){
      setFieldError(form, 'password', err && err.message === '返回用户数据异常' ? err.message : '无法连接服务器');
      submitBtn.disabled = false;
      submitBtn.textContent = '登录';
    }
  }

  function handleLogout(){
    if(!confirm('确定要退出登录吗？')) return;

    clearSession();
    adminToken = null;
    syncToken = null;
    currentUser = null;
    toast('已退出登录', 'info');
    emitChange();
    closeModal();
    updateFloatButton();
  }

  function cleanupDeletedAccount(email){
    const emailLower = String(email || '').toLowerCase();
    const encodedLower = encodeURIComponent(emailLower);
    try {
      localStorage.removeItem('qbti_results_' + emailLower);
      localStorage.removeItem('qbti_results_' + email);
      localStorage.removeItem('qbti_settings_v2_user_' + encodedLower);
      localStorage.removeItem('qbti_settings_v2_user_' + encodeURIComponent(email));
      localStorage.removeItem('qbti_result_tour_v1_' + emailLower);
      localStorage.removeItem('qbti_result_tour_v1_' + email);
      localStorage.removeItem('qbti_ai_cache_v1');
      localStorage.removeItem('qbti_ai_daily_v1');
      localStorage.removeItem('qbti_ai_lock_v1:' + emailLower);
      localStorage.removeItem('qbti_ai_tokens_v1:' + emailLower);
      localStorage.removeItem('qbti_ai_inflight_v1:' + emailLower);
      localStorage.removeItem('qbti_ai_burst_v1:' + emailLower);
      localStorage.removeItem('qbti_settings_v1');
      localStorage.removeItem('qbti_config_v2');
      localStorage.removeItem('qbti_session_v1');
    } catch(e){}
    const users = loadUsers().filter(u => !u.email || u.email.toLowerCase() !== emailLower);
    saveUsers(users);
    clearSession();
    adminToken = null;
    syncToken = null;
    currentUser = null;
    emitChange();
    closeModal();
    updateFloatButton();
  }

  function showDeleteAccountModal(){
    if(!currentUser || currentUser.role === 'admin') return;
    const email = currentUser.email;
    const old = document.getElementById('qauthDeleteMask');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'qauth-delete-mask';
    mask.id = 'qauthDeleteMask';
    mask.innerHTML = `
      <div class="qauth-delete-modal">
        <h3>注销账户</h3>
        <p>注销后会永久删除该账户的注册信息、历史问卷记录、绑定关系与解析报告；本机相关设置也会清除。该邮箱之后可以重新注册。</p>
        <div class="qauth-field"><label>输入账户邮箱确认</label><input id="qauthDelEmail" type="text" placeholder="${escapeHTML(email)}" autocomplete="off" /></div>
        <div class="qauth-field"><label>密码</label><input id="qauthDelPwd" type="password" placeholder="输入当前密码" autocomplete="current-password" /></div>
        <label class="qauth-delete-check"><input type="checkbox" id="qauthDelCheck" /> 我已知晓：注销后不可恢复</label>
        <div class="qauth-delete-actions">
          <button type="button" id="qauthDelCancel">取消</button>
          <button type="button" class="danger" id="qauthDelConfirm" disabled>永久注销</button>
        </div>
        <div class="qauth-delete-err" id="qauthDelErr"></div>
      </div>`;
    document.body.appendChild(mask);
    const check = mask.querySelector('#qauthDelCheck');
    const confirmBtn = mask.querySelector('#qauthDelConfirm');
    const errEl = mask.querySelector('#qauthDelErr');
    check.addEventListener('change', () => { confirmBtn.disabled = !check.checked; });
    mask.querySelector('#qauthDelCancel').addEventListener('click', () => mask.remove());
    mask.addEventListener('click', e => { if(e.target === mask) mask.remove(); });
    confirmBtn.addEventListener('click', async () => {
      const typedEmail = String(mask.querySelector('#qauthDelEmail').value || '').trim();
      const pwd = String(mask.querySelector('#qauthDelPwd').value || '');
      errEl.textContent = '';
      if(typedEmail.toLowerCase() !== email.toLowerCase()){ errEl.textContent = '邮箱与当前账户不一致'; return; }
      if(!pwd){ errEl.textContent = '请输入密码'; return; }
      if(!confirm('最后一次确认：永久注销该账户？此操作不可恢复。')) return;
      confirmBtn.disabled = true;
      try {
        const res = await fetch(API_BASE + '/api/student/delete-account', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pwd })
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok || !data.success){
          errEl.textContent = data.error || '注销失败';
          confirmBtn.disabled = false;
          return;
        }
        mask.remove();
        toast('账户已注销', 'ok');
        cleanupDeletedAccount(email);
      } catch(e){
        errEl.textContent = '无法连接服务器';
        confirmBtn.disabled = false;
      }
    });
  }

  function renderProfileContent(){
    const wrap = document.getElementById('qauthProfileContent');
    if(!wrap) return;
    if(!currentUser){
      wrap.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">未登录</p>';
      return;
    }
    const initial = (currentUser.username || '?').slice(0, 1).toUpperCase();
    const adminBadge = currentUser.role === 'admin'
      ? '<span class="qauth-admin-badge">ADMIN</span>' : '';
    const bindSection = currentUser.role === 'admin'
      ? '<div class="qauth-bind-section" style="border-color:rgba(255,180,60,.3);background:rgba(255,180,60,.06);"><div class="qauth-bind-title"><span>🔧 管理员模式</span></div><div class="qauth-bind-empty">作为内置管理员，您可以：<br>• 使用右下角 ⚙ 打开模型接口参数（地址 / Key / 模型 / Temperature / Max tokens）<br>• 使用 🎨 → 底部「管理员高级权限」：原始数据面板、强制简洁特效、静音/禁用震动、导出本地数据、清除解析缓存与额度、清除历史、服务器健康检查<br>• 不参与家长绑定流程</div></div>'
      : `
      <div class="qauth-bind-section" id="qauthBindSection">
        <div class="qauth-bind-title">
          <span>已绑定的家长</span>
          <span class="qauth-bind-count" id="qauthBindCount">加载中…</span>
        </div>
        <div id="qauthBindList" class="qauth-bind-empty">正在加载…</div>
        <div class="qauth-bind-actions">
          <button type="button" class="qauth-bind-gen-btn" id="qauthBindGen" disabled>生成绑定邀请码</button>
          <button type="button" class="qauth-bind-refresh-btn" id="qauthBindRefresh">刷新</button>
        </div>
      </div>`;

    wrap.innerHTML = `
      <div class="qauth-profile-row">
        <div class="qauth-profile-avatar">${escapeHTML(initial)}</div>
        <div class="qauth-profile-info">
          <div class="qauth-profile-name">${escapeHTML(currentUser.username)}${adminBadge}</div>
          <div class="qauth-profile-meta">${escapeHTML(currentUser.email)}</div>
        </div>
      </div>
      <div class="qauth-profile-detail">
        <div class="qauth-profile-detail-row"><span class="k">邮箱</span><span class="v">${escapeHTML(currentUser.email)}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">手机号</span><span class="v">${escapeHTML(currentUser.phone || '—')}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">用户名</span><span class="v">${escapeHTML(currentUser.username)}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">角色</span><span class="v">${currentUser.role === 'admin' ? '管理员' : '学生'}</span></div>
        <div class="qauth-profile-detail-row"><span class="k">注册时间</span><span class="v">${formatTime(currentUser.createdAt)}</span></div>
      </div>
      ${bindSection}
      ${currentUser.role !== 'admin' ? '<div class="qauth-danger-zone"><button type="button" class="qauth-delete-account-btn" id="qauthDeleteAccount">注销账户</button></div>' : ''}
    `;

    if(currentUser.role !== 'admin'){
      document.getElementById('qauthBindGen').addEventListener('click', handleGenerateInvite);
      document.getElementById('qauthBindRefresh').addEventListener('click', loadBoundParents);
      document.getElementById('qauthDeleteAccount').addEventListener('click', showDeleteAccountModal);
      loadBoundParents();
    }
  }

  async function loadBoundParents(){
    const listEl = document.getElementById('qauthBindList');
    const countEl = document.getElementById('qauthBindCount');
    const genBtn = document.getElementById('qauthBindGen');
    if(!listEl || !currentUser) return;

    try {
      const res = await fetch(API_BASE + '/api/bind/list/' + encodeURIComponent(currentUser.email));
      const data = await res.json();
      if(!res.ok || !data.success) throw new Error(data.error || '加载失败');

      const list = data.list || [];
      if(countEl) countEl.textContent = list.length + ' / ' + data.max;

      if(list.length === 0){
        listEl.className = 'qauth-bind-empty';
        listEl.textContent = '尚未绑定家长。点击下方按钮生成邀请码，或让家长扫描二维码。';
      } else {
        listEl.className = '';
        listEl.innerHTML = list.map(p => {
          const init = (p.parentUsername || '?').slice(0, 1).toUpperCase();
          return '<div class="qauth-bind-item">'
            + '<div class="qauth-bind-item-avatar">' + escapeHTML(init) + '</div>'
            + '<div class="qauth-bind-item-info">'
            +   '<div class="qauth-bind-item-name">' + escapeHTML(p.parentUsername) + '</div>'
            +   '<div class="qauth-bind-item-meta">' + escapeHTML(p.parentEmail) + '</div>'
            + '</div>'
            + '<button class="qauth-bind-item-remove" data-email="' + escapeHTML(p.parentEmail) + '" title="解除绑定">×</button>'
            + '</div>';
        }).join('');

        listEl.querySelectorAll('.qauth-bind-item-remove').forEach(btn => {
          btn.addEventListener('click', () => handleRemoveParent(btn.dataset.email));
        });
      }

      if(genBtn){
        genBtn.disabled = list.length >= 2;
        genBtn.textContent = list.length >= 2 ? '已达绑定上限（2/2）' : '生成邀请码 / 二维码';
      }
    } catch(err){
      listEl.className = 'qauth-bind-empty';
      listEl.innerHTML = '<span style="color:#FF8FA0">加载失败：' + escapeHTML(err.message) + '</span><br>请确认已通过 node server.js 启动服务';
      if(genBtn) genBtn.disabled = true;
      if(countEl) countEl.textContent = '—';
    }
  }

  async function handleGenerateInvite(){
    if(!currentUser) return;
    const btn = document.getElementById('qauthBindGen');
    if(!btn) return;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = '生成中…';

    try {
      const res = await fetch(API_BASE + '/api/bind/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: currentUser.email,
          studentUsername: currentUser.username
        })
      });
      const data = await res.json();
      if(!res.ok || !data.success) throw new Error(data.error || '生成失败');
      showInviteModal(data.code, data.expiresAt);
    } catch(err){
      toast('生成失败：' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }

  function loadQRCodeLib(callback, onFail){
    if(window.QRCode) { callback(); return; }
    const urls = [
      'qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    ];
    let index = 0;
    const next = function(){
      if(index >= urls.length){
        if(onFail) onFail();
        return;
      }
      const script = document.createElement('script');
      script.src = urls[index++];
      script.onload = function(){ if(window.QRCode) callback(); else next(); };
      script.onerror = next;
      document.head.appendChild(script);
    };
    next();
  }

  function showQRCodeFallback(box, code, shareUrl){
    if(!box) return;
    box.innerHTML = '<div style="text-align:center;color:#111;font-size:12px;line-height:1.6;padding:8px;">'
      + '<div style="font-size:30px;margin-bottom:6px;">▦</div>'
      + '<b>二维码加载失败</b><br>'
      + '请复制邀请码：<br>'
      + '<span style="font-family:monospace;font-size:16px;font-weight:800;letter-spacing:.12em;">' + escapeHTML(code) + '</span>'
      + '</div>';
    try { box.title = shareUrl; } catch(e){}
  }

  function showInviteModal(code, expiresAt){
    const old = document.getElementById('qauthInviteMask');
    if(old) old.remove();

    const configuredParent = '';
    const storedParent = (() => { try { return localStorage.getItem('qbti_parent_app_url') || ''; } catch(e){ return ''; } })();
    const PARENT_APP_URL = (window.QBTI_PARENT_APP_URL || storedParent || configuredParent || 'https://qbti-parent.onrender.com').replace(/\/+$/, '');
    const shareUrl = PARENT_APP_URL + '/?code=' + encodeURIComponent(code);

    const mask = document.createElement('div');
    mask.id = 'qauthInviteMask';
    mask.className = 'qauth-invite-mask';
    mask.innerHTML = `
      <div class="qauth-invite-card">
        <div class="qauth-invite-kicker">Bind Parent · 绑定家长</div>
        <div class="qauth-invite-title">请家长使用摄像头扫描此二维码</div>

        <div class="qauth-qrcode-wrap" id="qrcodeBox"></div>

        <div class="qauth-invite-code">${escapeHTML(code)}</div>
        <div class="qauth-invite-meta">
          邀请码有效期至 ${new Date(expiresAt).toLocaleString()}<br>
          家长登录「家长端」后，点击「扫码绑定」即可自动完成
        </div>
        <div class="qauth-invite-actions">
          <button type="button" class="qauth-invite-copy" id="qauthInviteCopy">复制邀请链接</button>
          <button type="button" class="qauth-invite-close" id="qauthInviteClose">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);

    loadQRCodeLib(() => {
      const box = document.getElementById('qrcodeBox');
      if(!box) return;
      box.innerHTML = '';
      try {
        new QRCode(box, {
          text: shareUrl,
          width: 180,
          height: 180,
          colorDark : "#000000",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.H
        });
      } catch(e){
        showQRCodeFallback(box, code, shareUrl);
      }
    }, () => {
      const box = document.getElementById('qrcodeBox');
      if(box) showQRCodeFallback(box, code, shareUrl);
    });

    document.getElementById('qauthInviteCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        document.getElementById('qauthInviteCopy').textContent = '已复制 ✓';
      } catch(e){
        alert('复制失败，请手动记录邀请码：' + code);
      }
    });
    document.getElementById('qauthInviteClose').addEventListener('click', () => mask.remove());
    mask.addEventListener('click', e => { if(e.target === mask) mask.remove(); });
  }

  async function handleRemoveParent(parentEmail){
    if(!currentUser) return;
    if(!confirm('确定解除与该家长的绑定吗？')) return;
    try {
      const res = await fetch(API_BASE + '/api/bind/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentEmail: currentUser.email, parentEmail })
      });
      const data = await res.json();
      if(!res.ok || !data.success) throw new Error(data.error || '解绑失败');
      toast('已解除绑定', 'ok');
      loadBoundParents();
    } catch(err){
      toast('解绑失败：' + err.message, 'err');
    }
  }

  function updateFloatButton(){
    const btn = document.getElementById('qauthFloatBtn');
    if(!btn) return;
    if(currentUser){
      const initial = (currentUser.username || '?').slice(0, 1).toUpperCase();
      const adminMark = currentUser.role === 'admin' ? ' <span style="font-size:9px;color:#FFD98A;font-weight:800;">ADMIN</span>' : '';
      btn.innerHTML = '<span class="qauth-btn-avatar">' + escapeHTML(initial) + '</span>'
        + '<span class="qauth-btn-label">' + escapeHTML(currentUser.username) + adminMark + '</span>';
    } else {
      btn.innerHTML = '<span style="font-size:14px">🔐</span><span class="qauth-btn-label">登录 / 注册</span>';
    }
  }

  function init(){
    injectStyles();
    ensureAdminUser();
    const session = loadSession();
    if(session){
      adminToken = session.adminToken || null;
      syncToken = session.syncToken || adminToken || null;
      const user = findUserByEmail(session.email);
      if(user) currentUser = publicUser(user);
      else clearSession();
      if(currentUser && currentUser.role === 'admin' && !adminToken){
        currentUser = null;
        clearSession();
      }
    }
    if(currentUser && currentUser.role === 'admin') checkAdminPolicy();
    setInterval(function(){
      if(currentUser && currentUser.role === 'admin') checkAdminPolicy();
    }, 60 * 1000);
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
    console.log('[QAuth] 已初始化，登录状态:', !!currentUser, '角色:', currentUser ? currentUser.role : '-');
    setTimeout(function(){ emitChange(); }, 0);
  }

  const api = {
    getCurrentUser: function(){ return currentUser ? Object.assign({}, currentUser) : null; },
    isLoggedIn: function(){ return !!currentUser; },
    isAdmin: function(){ return !!(currentUser && currentUser.role === 'admin'); },
    getAdminToken: function(){ return adminToken; },
    getSyncToken: function(){ return adminToken || syncToken; },
    logout: function(){ handleLogout(); },
    onChange: function(fn){
      if(typeof fn !== 'function') return function(){};
      listeners.push(fn);
      setTimeout(() => {
        try { fn({ isLoggedIn: !!currentUser, user: currentUser ? Object.assign({}, currentUser) : null }); }
        catch(e){}
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
    },
    checkAdminPolicy: checkAdminPolicy,
    resetAdmin: function(){
      try { localStorage.removeItem(USERS_KEY); } catch(e){}
      ensureAdminUser();
      return ADMIN_USERNAME + ' / ' + ADMIN_PASSWORD;
    }
  };

  window.QAuth = api;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();