/* ============================================================
   QBTI Settings —— 独立设置模块
   - 语言：<select> 下拉（8 种语言）
   - 字体大小：<input type="range"> 80-150，无级调节
   - 字体粗细：按钮切换
   - 亮度：range 50-150
   - 特效模式：简洁 / 常规
   - 通过 body zoom + --q-fs 双通道保证变化肉眼可见
   ============================================================ */
(function(){
  'use strict';

  const SETTINGS_KEY = 'qbti_settings_v1';
  const DEFAULT_SETTINGS = {
    brightness: 100,
    effectsMode: 'normal',
    lang: 'zh-CN',
    fontSize: 100,      /* 百分比 80-150 */
    fontWeight: 'normal'
  };

  const $ = id => document.getElementById(id);
  const listeners = [];
  let cur = loadSettings();

  function loadSettings(){
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if(!raw) return Object.assign({}, DEFAULT_SETTINGS);
      const s = JSON.parse(raw) || {};
      const merged = Object.assign({}, DEFAULT_SETTINGS, s);
      // 兼容旧字段
      if(typeof merged.fontSize === 'string'){
        merged.fontSize = { sm: 88, md: 100, lg: 118 }[merged.fontSize] || 100;
      }
      if(merged.fontSize == null || isNaN(merged.fontSize)) merged.fontSize = 100;
      // 兼容旧 lang
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

  /* ★ 字体大小：body zoom + --q-fs 变量，确保全局可见变化 */
  function applyFontScale(v){
    const pct = Math.max(80, Math.min(150, Number(v) || 100));
    const z = pct / 100;
    document.documentElement.style.setProperty('--q-fs', z);
    /* 双通道：① CSS 变量给 calc 用 ② body zoom 直接放大一切 */
    document.body.style.zoom = z;
    /* 等浏览器完成布局后重算 canvas 尺寸 */
    if(window.QuantumSphere && window.QuantumSphere.resize){
      setTimeout(() => window.QuantumSphere.resize(), 50);
      setTimeout(() => window.QuantumSphere.resize(), 250);
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
    if(window.QuantumSphere.setEffectsMode){
      window.QuantumSphere.setEffectsMode(s.effectsMode || 'normal');
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

    /* 填充语言下拉 */
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
      /* 语言部分提示 */
      const noteEl = $('setLangNote');
      if(noteEl && window.QBTI_I18N){
        const I18N = window.QBTI_I18N;
        const base = I18N.t('settings.langNote');
        const partial = I18N.hasFullQuestion() ? '' : I18N.t('settings.langPartial');
        noteEl.textContent = base + partial;
      }
    }

    /* 亮度 */
    if(setBrightness){
      setBrightness.addEventListener('input', () => {
        const v = Number(setBrightness.value);
        cur.brightness = v;
        if(setBrightnessVal) setBrightnessVal.textContent = v + '%';
        applyBrightness(v);
      });
      setBrightness.addEventListener('change', () => { saveSettings(cur); emit('brightness'); });
    }

    /* ★ 字体大小滑块 */
    if(setFontSize){
      setFontSize.addEventListener('input', () => {
        const v = Number(setFontSize.value);
        cur.fontSize = v;
        if(setFontSizeVal) setFontSizeVal.textContent = v + '%';
        applyFontScale(v);
      });
      setFontSize.addEventListener('change', () => { saveSettings(cur); emit('fontSize'); });
    }

    /* ★ 语言下拉 */
    if(setLang){
      setLang.addEventListener('change', () => {
        cur.lang = setLang.value;
        saveSettings(cur);
        applyLang(cur.lang);
        syncUI();
        emit('lang');
      });
    }

    /* 特效模式 / 字体粗细 */
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

    /* 恢复默认 */
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

    function openMask(){ mask.classList.add('show'); syncUI(); }
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
    syncUI();

    mask._syncUI = syncUI;
  }

  /* ============ 初始化 ============ */
  function init(){
    /* 首屏应用 */
    applyBrightness(cur.brightness);
    applyFontScale(cur.fontSize);
    applyFontWeight(cur.fontWeight);

    function boot(){
      if(window.QBTI_I18N){
        window.QBTI_I18N.set(cur.lang);
        window.QBTI_I18N.apply(document);
      }
      if($('settingsMask')) initPanel();

      /* 等 QuantumSphere 就绪 */
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
    }
  };

  init();
})();