/* ============================================================
   QBTI Settings —— 独立设置模块
   - 语言：<select> 下拉（8 种语言）
   - 字体大小：<input type="range"> 80-150，只缩放文字，不动布局
   - 字体粗细：按钮切换
   - 亮度：range 50-150
   - 特效模式：简洁 / 常规
   ============================================================ */
(function(){
  'use strict';

  const SETTINGS_KEY = 'qbti_settings_v1';
  const DEFAULT_SETTINGS = {
    brightness: 100,
    effectsMode: 'normal',
    lang: 'zh-CN',
    fontSize: 100,
    fontWeight: 'normal',
    /* 管理员高级设置（仅管理员面板可见，普通用户不会显示） */
    adminDebug: false,
    adminForceSimple: false,
    adminMuteSound: false,
    adminDisableHaptic: false
  };

  const $ = id => document.getElementById(id);
  const listeners = [];
  let cur = loadSettings();

  function isAdmin(){
    return !!(window.QAuth && window.QAuth.isAdmin && window.QAuth.isAdmin());
  }
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function loadSettings(){
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if(!raw) return Object.assign({}, DEFAULT_SETTINGS);
      const s = JSON.parse(raw) || {};
      const merged = Object.assign({}, DEFAULT_SETTINGS, s);
      if(typeof merged.fontSize === 'string'){
        merged.fontSize = { sm: 88, md: 100, lg: 118 }[merged.fontSize] || 100;
      }
      if(merged.fontSize == null || isNaN(merged.fontSize)) merged.fontSize = 100;
      if(merged.lang === 'zh') merged.lang = 'zh-CN';
      delete merged.interactive;
      return merged;
    } catch(e){ return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s){
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e){}
  }
  function emit(key){
    listeners.forEach(fn => { try { fn({ key: key, settings: Object.assign({}, cur) }); } catch(e){} });
  }

  /* ============ 应用函数 ============ */
  function applyBrightness(v){
    const b = Math.max(50, Math.min(150, Number(v) || 100)) / 100;
    document.documentElement.style.setProperty('--q-brightness', b);
  }

  /* ★ 字体大小：只通过 --q-fs 影响所有 font-size:calc(... * var(--q-fs))
     —— 不再使用 body zoom，布局不缩放，只让文字变大变小 */
  function applyFontScale(v){
    const pct = Math.max(80, Math.min(150, Number(v) || 100));
    const z = pct / 100;
    document.documentElement.style.setProperty('--q-fs', z);
    /* 布局尺寸不变，canvas 无需 resize；保留兜底以防万一 */
    if(window.QuantumSphere && window.QuantumSphere.resize){
      setTimeout(() => window.QuantumSphere.resize(), 60);
    }
  }

  function applyFontWeight(weight){
    document.body.classList.toggle('q-bold', weight === 'bold');
  }

  function applyLang(lang){
    if(window.QBTI_I18N){
      window.QBTI_I18N.set(lang);
      window.QBTI_I18N.apply(document);
    }
  }

  function applySpherePrefs(s){
    if(!window.QuantumSphere) return;
    const admin = isAdmin();
    const mode = (admin && s.adminForceSimple) ? 'simple' : (s.effectsMode || 'normal');
    if(window.QuantumSphere.setEffectsMode){
      window.QuantumSphere.setEffectsMode(mode);
    }
    if(admin){
      if(window.QuantumSphere.sound && window.QuantumSphere.sound.setEnabled){
        window.QuantumSphere.sound.setEnabled(!s.adminMuteSound);
      }
      if(window.QuantumSphere.haptic && window.QuantumSphere.haptic.setEnabled){
        window.QuantumSphere.haptic.setEnabled(!s.adminDisableHaptic);
      }
    }
  }

  function applyAll(s){
    applyBrightness(s.brightness);
    applyFontScale(s.fontSize);
    applyFontWeight(s.fontWeight);
    applyLang(s.lang);
    applySpherePrefs(s);
  }

  /* ============ 面板 UI ============ */
  function initPanel(){
    const mask = $('settingsMask');
    if(!mask) return;

    const setBrightness = $('setBrightness');
    const setBrightnessVal = $('setBrightnessVal');
    const setFontSize = $('setFontSize');
    const setFontSizeVal = $('setFontSizeVal');
    const setLang = $('setLang');
    const groups = {
      effectsMode: $('setEffectsMode'),
      fontWeight: $('setFontWeight')
    };

    function buildLangSelect(){
      if(!setLang || !window.QBTI_I18N) return;
      const I18N = window.QBTI_I18N;
      setLang.innerHTML = I18N.LANGS.map(code =>
        '<option value="' + code + '">' + I18N.LANG_NAMES[code] + '</option>'
      ).join('');
      setLang.value = cur.lang;
    }

    function syncUI(){
      if(setBrightness){ setBrightness.value = cur.brightness; }
      if(setBrightnessVal){ setBrightnessVal.textContent = cur.brightness + '%'; }
      if(setFontSize){ setFontSize.value = cur.fontSize; }
      if(setFontSizeVal){ setFontSizeVal.textContent = cur.fontSize + '%'; }
      if(setLang){ setLang.value = cur.lang; }
      Object.keys(groups).forEach(k => {
        const el = groups[k];
        if(!el) return;
        el.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.val === String(cur[k]));
        });
      });
      const noteEl = $('setLangNote');
      if(noteEl && window.QBTI_I18N){
        const I18N = window.QBTI_I18N;
        const base = I18N.t('settings.langNote');
        const partial = I18N.hasFullQuestion() ? '' : I18N.t('settings.langPartial');
        noteEl.textContent = base + partial;
      }
      syncAdminUI();
    }

    /* ============ 管理员高级权限 ============ */
    function setSwitch(el, on){
      if(!el) return;
      el.classList.toggle('on', !!on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      el.textContent = on ? 'ON' : 'OFF';
    }

    function adminStats(){
      const el = $('adminStats');
      if(!el) return;
      let bytes = 0;
      try {
        for(let i = 0; i < localStorage.length; i++){
          const k = localStorage.key(i);
          if(!k) continue;
          if(k.indexOf('qbti_') !== 0 && k !== 'qs_sound_enabled') continue;
          const v = localStorage.getItem(k) || '';
          bytes += (k.length + v.length) * 2;
        }
      } catch(e){}
      let users = 0, history = 0;
      try { users = (JSON.parse(localStorage.getItem('qbti_users_v1') || '[]') || []).length; } catch(e){}
      try {
        for(let i = 0; i < localStorage.length; i++){
          const k = localStorage.key(i);
          if(k && k.indexOf('qbti_results_') === 0){
            const arr = JSON.parse(localStorage.getItem(k) || '[]');
            if(Array.isArray(arr)) history += arr.length;
          }
        }
      } catch(e){}
      let daily = 0, cache = '无';
      try {
        const d = new Date();
        const day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
        const q = JSON.parse(localStorage.getItem('qbti_ai_daily_v1') || 'null');
        if(q && q.date === day) daily = Number(q.count) || 0;
        const c = JSON.parse(localStorage.getItem('qbti_ai_cache_v1') || 'null');
        if(c && c.text) cache = (c.lang || 'zh-CN') + ' / ' + (c.source || 'ai');
      } catch(e){}
      el.innerHTML = '<span>账户 <b>' + users + '</b></span>'
        + '<span>历史 <b>' + history + '</b></span>'
        + '<span>存储 <b>' + (bytes / 1024).toFixed(1) + ' KB</b></span>'
        + '<span>今日 AI <b>' + daily + ' / 10</b></span>'
        + '<span>AI 缓存 <b>' + esc(cache) + '</b></span>';
    }

    function syncAdminUI(){
      if(!isAdmin()) return;
      setSwitch($('adminDebugBtn'), cur.adminDebug);
      setSwitch($('adminSimpleBtn'), cur.adminForceSimple);
      setSwitch($('adminSoundBtn'), cur.adminMuteSound);
      setSwitch($('adminHapticBtn'), cur.adminDisableHaptic);
      adminStats();
    }

    function adminNote(msg, isErr){
      const el = $('adminHealth');
      if(!el) return;
      el.textContent = msg;
      el.style.color = isErr ? '#FF8FA0' : 'var(--muted)';
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.textContent = ''; }, 5000);
    }

    function toggleAdmin(key){
      if(!isAdmin()) return;
      cur[key] = !cur[key];
      saveSettings(cur);
      applyAll(cur);
      syncUI();
      emit(key);
    }

    function adminApi(){
      if(!isAdmin()) return;
      closeMask();
      const gear = $('btnGear');
      if(gear) gear.click();
      else adminNote('未找到 AI 接口设置入口', true);
    }

    function adminHealth(){
      if(!isAdmin()) return;
      const out = $('adminHealth');
      if(out) out.textContent = '检查中…';
      fetch('/api/health').then(r => r.json()).then(d => {
        if(out){
          out.textContent = 'HTTP OK · 邮件 ' + (d.mailer ? '已配置' : '未配置') + ' · 数据库 ' + (d.database || '未知');
          out.style.color = d.database === 'connected' ? '#9EEBB8' : '#FFD98A';
        }
      }).catch(() => adminNote('服务器健康检查失败', true));
    }

    function adminExport(){
      if(!isAdmin()) return;
      if(!confirm('导出会包含本地账户、历史记录和 API 配置（含密码哈希），确定继续？')) return;
      const dump = { exportedAt: new Date().toISOString(), origin: location.origin, keys: {} };
      try {
        for(let i = 0; i < localStorage.length; i++){
          const k = localStorage.key(i);
          if(!k) continue;
          if(k.indexOf('qbti_') !== 0 && k !== 'qs_sound_enabled') continue;
          dump.keys[k] = localStorage.getItem(k);
        }
      } catch(e){}
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'qbti-admin-export-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      adminNote('已导出本地数据');
    }

    function adminClearAI(){
      if(!isAdmin()) return;
      if(!confirm('清除 AI 报告缓存与今日额度？')) return;
      try {
        localStorage.removeItem('qbti_ai_cache_v1');
        localStorage.removeItem('qbti_ai_daily_v1');
      } catch(e){}
      adminStats();
      adminNote('已清除 AI 缓存与额度');
      emit('adminClearAI');
    }

    function adminClearHistory(){
      if(!isAdmin()) return;
      if(!confirm('清除本机所有学生的历史测评记录？此操作不可恢复。')) return;
      try {
        const keys = [];
        for(let i = 0; i < localStorage.length; i++){
          const k = localStorage.key(i);
          if(k && k.indexOf('qbti_results_') === 0) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));
      } catch(e){}
      adminStats();
      adminNote('已清除本机历史记录');
      window.dispatchEvent(new CustomEvent('qbti:admin-data-cleared'));
    }

    function bindAdminEvents(){
      const map = {
        adminDebugBtn: 'adminDebug',
        adminSimpleBtn: 'adminForceSimple',
        adminSoundBtn: 'adminMuteSound',
        adminHapticBtn: 'adminDisableHaptic'
      };
      Object.keys(map).forEach(id => {
        const el = $(id);
        if(el) el.addEventListener('click', () => toggleAdmin(map[id]));
      });
      const api = $('adminApiBtn'); if(api) api.addEventListener('click', adminApi);
      const health = $('adminHealthBtn'); if(health) health.addEventListener('click', adminHealth);
      const exp = $('adminExportBtn'); if(exp) exp.addEventListener('click', adminExport);
      const clearAI = $('adminClearAIBtn'); if(clearAI) clearAI.addEventListener('click', adminClearAI);
      const clearHist = $('adminClearHistoryBtn'); if(clearHist) clearHist.addEventListener('click', adminClearHistory);
    }

    function buildAdminSection(){
      if(!isAdmin()){
        const old = $('adminSettingsGroup');
        if(old) old.remove();
        return;
      }
      const modal = document.querySelector('.settings-modal');
      if(!modal) return;
      if($('adminSettingsGroup')){ syncAdminUI(); return; }
      const group = document.createElement('div');
      group.className = 'settings-group admin-group';
      group.id = 'adminSettingsGroup';
      group.innerHTML = `
        <div class="settings-group-title admin-title"><span>管理员高级权限</span><span class="admin-badge">ADMIN</span></div>
        <div class="admin-stats" id="adminStats"></div>
        <div class="settings-row"><label>显示原始数据面板</label><button type="button" class="admin-switch" id="adminDebugBtn">OFF</button></div>
        <div class="settings-row"><label>强制简洁特效</label><button type="button" class="admin-switch" id="adminSimpleBtn">OFF</button></div>
        <div class="settings-row"><label>静音（音效）</label><button type="button" class="admin-switch" id="adminSoundBtn">OFF</button></div>
        <div class="settings-row"><label>禁用震动</label><button type="button" class="admin-switch" id="adminHapticBtn">OFF</button></div>
        <div class="admin-actions">
          <button type="button" class="admin-action" id="adminApiBtn">⚙ AI 接口参数</button>
          <button type="button" class="admin-action" id="adminHealthBtn">🩺 服务器健康</button>
          <button type="button" class="admin-action" id="adminExportBtn">⬇ 导出本地数据</button>
          <button type="button" class="admin-action" id="adminClearAIBtn">🧹 清除 AI 缓存/额度</button>
          <button type="button" class="admin-action danger" id="adminClearHistoryBtn">🗑 清除所有历史记录</button>
        </div>
        <div class="admin-health" id="adminHealth"></div>
      `;
      const actions = modal.querySelector('.settings-actions');
      if(actions) modal.insertBefore(group, actions); else modal.appendChild(group);
      bindAdminEvents();
      syncAdminUI();
    }

    if(setBrightness){
      setBrightness.addEventListener('input', () => {
        const v = Number(setBrightness.value);
        cur.brightness = v;
        if(setBrightnessVal) setBrightnessVal.textContent = v + '%';
        applyBrightness(v);
      });
      setBrightness.addEventListener('change', () => { saveSettings(cur); emit('brightness'); });
    }

    if(setFontSize){
      setFontSize.addEventListener('input', () => {
        const v = Number(setFontSize.value);
        cur.fontSize = v;
        if(setFontSizeVal) setFontSizeVal.textContent = v + '%';
        applyFontScale(v);
      });
      setFontSize.addEventListener('change', () => { saveSettings(cur); emit('fontSize'); });
    }

    if(setLang){
      setLang.addEventListener('change', () => {
        cur.lang = setLang.value;
        saveSettings(cur);
        applyLang(cur.lang);
        syncUI();
        emit('lang');
      });
    }

    function bindGroup(name, onChange){
      const el = groups[name];
      if(!el) return;
      el.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.val));
      });
    }
    bindGroup('effectsMode', v => {
      cur.effectsMode = (v === 'simple') ? 'simple' : 'normal';
      saveSettings(cur); applySpherePrefs(cur); syncUI(); emit('effectsMode');
    });
    bindGroup('fontWeight', v => {
      cur.fontWeight = (v === 'bold') ? 'bold' : 'normal';
      saveSettings(cur); applyFontWeight(cur.fontWeight); syncUI(); emit('fontWeight');
    });

    const resetBtn = $('setReset');
    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        const msg = window.QBTI_I18N && window.QBTI_I18N.current !== 'zh-CN'
          ? 'Reset all settings to default?'
          : '确定恢复所有设置为默认值吗？';
        if(!confirm(msg)) return;
        cur = Object.assign({}, DEFAULT_SETTINGS);
        saveSettings(cur);
        applyAll(cur);
        syncUI();
        emit('reset');
      });
    }

    function openMask(){ buildAdminSection(); mask.classList.add('show'); syncUI(); }
    function closeMask(){ mask.classList.remove('show'); }

    const btnSettings = $('btnSettings');
    if(btnSettings) btnSettings.addEventListener('click', openMask);
    const closeBtn = $('settingsClose');
    if(closeBtn) closeBtn.addEventListener('click', closeMask);
    const doneBtn = $('setDone');
    if(doneBtn) doneBtn.addEventListener('click', closeMask);
    mask.addEventListener('click', e => { if(e.target === mask) closeMask(); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && mask.classList.contains('show')) closeMask();
    });

    buildLangSelect();
    buildAdminSection();
    syncUI();

    mask._syncUI = syncUI;
    mask._buildAdmin = buildAdminSection;
  }

  /* ============ 初始化 ============ */
  function init(){
    applyBrightness(cur.brightness);
    applyFontScale(cur.fontSize);
    applyFontWeight(cur.fontWeight);

    function boot(){
      if(window.QBTI_I18N){
        window.QBTI_I18N.set(cur.lang);
        window.QBTI_I18N.apply(document);
      }
      if($('settingsMask')) initPanel();

      let tries = 0;
      const wait = setInterval(() => {
        tries++;
        if(window.QuantumSphere || tries > 30){
          clearInterval(wait);
          applySpherePrefs(cur);
        }
      }, 100);
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  window.QBTISettings = {
    get: () => Object.assign({}, cur),
    reset: () => {
      cur = Object.assign({}, DEFAULT_SETTINGS);
      saveSettings(cur);
      applyAll(cur);
      emit('reset');
    },
    open: () => {
      const mask = $('settingsMask');
      if(mask){
        if(mask._buildAdmin) mask._buildAdmin();
        if(mask._syncUI) mask._syncUI();
        mask.classList.add('show');
      }
    },
    onChange: fn => {
      if(typeof fn !== 'function') return () => {};
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if(i >= 0) listeners.splice(i, 1);
      };
    },
    refreshLang: () => {
      applyLang(cur.lang);
      const mask = $('settingsMask');
      if(mask && mask._syncUI) mask._syncUI();
    },
    refreshAdmin: () => {
      applySpherePrefs(cur);
      const mask = $('settingsMask');
      if(mask && mask._buildAdmin) mask._buildAdmin();
      if(mask && mask._syncUI) mask._syncUI();
    }
  };

  init();
})();