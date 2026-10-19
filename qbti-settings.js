/* ============================================================
   QBTI Settings —— 独立设置模块
   暴露：window.QBTISettings
   - 加载/保存设置（localStorage）
   - 应用亮度 / 特效模式 / 语言 / 字体大小 / 粗细
   - 绑定设置面板 UI
   - onChange 回调（语言/字体等变化时通知外部）
   ============================================================ */
(function(){
  'use strict';

  const SETTINGS_KEY = 'qbti_settings_v1';
  const DEFAULT_SETTINGS = {
    brightness: 100,
    effectsMode: 'normal',
    lang: 'zh',
    fontSize: 'md',
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
      delete merged.interactive; // 兼容旧版本字段
      return merged;
    } catch(e){ return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s){
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e){}
  }
  function emit(key){
    listeners.forEach(fn => { try { fn({ key: key, settings: Object.assign({}, cur) }); } catch(e){} });
  }

  /* ---------- 应用函数 ---------- */
  function applyBrightness(v){
    const b = Math.max(50, Math.min(150, Number(v) || 100)) / 100;
    document.documentElement.style.setProperty('--q-brightness', b);
  }
  function applyFontSize(size){
    const map = { sm: 0.92, md: 1, lg: 1.14 };
    document.documentElement.style.setProperty('--q-fs', map[size] || 1);
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
    if(window.QuantumSphere.setEffectsMode){
      window.QuantumSphere.setEffectsMode(s.effectsMode || 'normal');
    }
  }
  function applyAll(s){
    applyBrightness(s.brightness);
    applyFontSize(s.fontSize);
    applyFontWeight(s.fontWeight);
    applyLang(s.lang);
    applySpherePrefs(s);
  }

  /* ---------- 面板 UI ---------- */
  function initPanel(){
    const mask = $('settingsMask');
    if(!mask) return;

    const setBrightness = $('setBrightness');
    const setBrightnessVal = $('setBrightnessVal');
    const groups = {
      effectsMode: $('setEffectsMode'),
      lang: $('setLang'),
      fontSize: $('setFontSize'),
      fontWeight: $('setFontWeight')
    };

    function syncUI(){
      setBrightness.value = cur.brightness;
      setBrightnessVal.textContent = cur.brightness + '%';
      Object.keys(groups).forEach(k => {
        const el = groups[k];
        if(!el) return;
        el.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.val === String(cur[k]));
        });
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
    bindGroup('lang', v => {
      const ok = ['zh','en','ja','ko'].indexOf(v) >= 0;
      if(!ok) return;
      cur.lang = v;
      saveSettings(cur); applyLang(cur.lang); syncUI(); emit('lang');
    });
    bindGroup('fontSize', v => {
      if(['sm','md','lg'].indexOf(v) < 0) return;
      cur.fontSize = v;
      saveSettings(cur); applyFontSize(cur.fontSize); syncUI(); emit('fontSize');
    });
    bindGroup('fontWeight', v => {
      cur.fontWeight = (v === 'bold') ? 'bold' : 'normal';
      saveSettings(cur); applyFontWeight(cur.fontWeight); syncUI(); emit('fontWeight');
    });

    setBrightness.addEventListener('input', () => {
      const v = Number(setBrightness.value);
      cur.brightness = v;
      setBrightnessVal.textContent = v + '%';
      applyBrightness(v);
    });
    setBrightness.addEventListener('change', () => {
      saveSettings(cur); emit('brightness');
    });

    function buildLangButtons(){
      const langGroup = $('setLang');
      if(!langGroup || !window.QBTI_I18N) return;
      langGroup.innerHTML = window.QBTI_I18N.LANGS.map(l =>
        '<button type="button" data-val="' + l + '">' + window.QBTI_I18N.LANG_NAMES[l] + '</button>'
      ).join('');
      langGroup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          cur.lang = btn.dataset.val;
          saveSettings(cur); applyLang(cur.lang); syncUI(); emit('lang');
        });
      });
    }

    $('setReset').addEventListener('click', () => {
      const msg = window.QBTI_I18N && cur.lang !== 'zh'
        ? 'Reset all settings to default?'
        : '确定恢复所有设置为默认值吗？';
      if(!confirm(msg)) return;
      cur = Object.assign({}, DEFAULT_SETTINGS);
      saveSettings(cur);
      applyAll(cur);
      syncUI();
      emit('reset');
    });

    function openMask(){ mask.classList.add('show'); syncUI(); }
    function closeMask(){ mask.classList.remove('show'); }

    $('btnSettings').addEventListener('click', openMask);
    $('settingsClose').addEventListener('click', closeMask);
    $('setDone').addEventListener('click', closeMask);
    mask.addEventListener('click', e => { if(e.target === mask) closeMask(); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && mask.classList.contains('show')) closeMask();
    });

    buildLangButtons();
    syncUI();

    /* 供外部重新应用 i18n（语言包变化后） */
    mask._syncUI = syncUI;
  }

  /* ---------- 初始化 ---------- */
  function init(){
    /* 1) 先应用设置（在 core 加载前完成基础属性设置） */
    applyBrightness(cur.brightness);
    applyFontSize(cur.fontSize);
    applyFontWeight(cur.fontWeight);

    /* 2) 等 QBTI_I18N / 面板就绪 */
    function boot(){
      if(window.QBTI_I18N){
        window.QBTI_I18N.set(cur.lang);
        window.QBTI_I18N.apply(document);
      }
      if($('settingsMask')){
        initPanel();
      }
      /* 3) 等 QuantumSphere 就绪后应用球体设置 */
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
    /* 供外部语言包变化后重新应用 */
    refreshLang: () => {
      applyLang(cur.lang);
      const mask = $('settingsMask');
      if(mask && mask._syncUI) mask._syncUI();
    }
  };

  init();
})();