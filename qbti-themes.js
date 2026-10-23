(function(){
  'use strict';
  const PALETTES = [
    { name: '极光', primary: [82, 224, 255], secondary: [126, 255, 192], accent: [255, 122, 222] },
    { name: '深海', primary: [48, 126, 255], secondary: [76, 224, 255], accent: [190, 242, 255] },
    { name: '熔金', primary: [255, 184, 72], secondary: [255, 126, 44], accent: [255, 232, 165] },
    { name: '绯月', primary: [255, 104, 166], secondary: [182, 94, 255], accent: [255, 214, 234] },
    { name: '苔原', primary: [92, 222, 152], secondary: [184, 255, 124], accent: [232, 255, 204] },
    { name: '星尘', primary: [184, 164, 255], secondary: [244, 224, 255], accent: [126, 204, 255] },
    { name: '雷暴', primary: [122, 154, 255], secondary: [82, 94, 186], accent: [234, 252, 255] },
    { name: '雾海', primary: [132, 194, 204], secondary: [194, 224, 255], accent: [255, 255, 255] },
    { name: '琥珀', primary: [255, 164, 84], secondary: [255, 214, 104], accent: [224, 244, 255] },
    { name: '青焰', primary: [72, 255, 212], secondary: [42, 184, 255], accent: [224, 255, 250] },
    { name: '夜航', primary: [72, 84, 164], secondary: [154, 124, 255], accent: [104, 224, 255] },
    { name: '赤潮', primary: [255, 84, 116], secondary: [255, 164, 84], accent: [255, 232, 184] }
  ];

  const HIDDEN = {
    freedom: { name: '苍穹脉冲', primary: [78, 176, 255], secondary: [228, 246, 255], accent: [255, 196, 76] },
    madman: { name: '裂面狂欢', primary: [146, 82, 255], secondary: [255, 74, 194], accent: [82, 242, 255] },
    einstein: { name: '粉笔星轨', primary: [255, 188, 92], secondary: [255, 242, 206], accent: [126, 218, 255] },
    jerry: { name: '奶酪轨道', primary: [255, 188, 74], secondary: [92, 244, 218], accent: [255, 242, 168] }
  };

  function hashString(str){
    let h = 2166136261;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rgbToHsl(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if(max !== min){
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if(max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if(max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  }

  function hslToRgb(h, s, l){
    h = ((h % 360) + 360) % 360 / 360;
    s /= 100; l /= 100;
    if(s === 0){
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = function(t){
      if(t < 0) t += 1;
      if(t > 1) t -= 1;
      if(t < 1/6) return p + (q - p) * 6 * t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return [Math.round(hue2rgb(h + 1/3) * 255), Math.round(hue2rgb(h) * 255), Math.round(hue2rgb(h - 1/3) * 255)];
  }

  function shift(rgb, delta, satBoost, lightBoost){
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return hslToRgb(hsl[0] + delta, Math.max(0, Math.min(100, hsl[1] + (satBoost || 0))), Math.max(0, Math.min(100, hsl[2] + (lightBoost || 0))));
  }

  function get(code, suffix, hiddenKey){
    if(hiddenKey && HIDDEN[hiddenKey]){
      const h = HIDDEN[hiddenKey];
      return {
        id: 'hidden-' + hiddenKey,
        name: h.name,
        primary: h.primary.slice(),
        secondary: h.secondary.slice(),
        accent: h.accent.slice(),
        limited: true,
        hidden: true
      };
    }
    const full = String(code || 'XUIT') + (suffix ? '-' + suffix : '');
    const hash = hashString(full);
    const base = PALETTES[hash % PALETTES.length];
    const delta = (hash % 46) - 23;
    return {
      id: 'type-' + full,
      name: base.name + ' · ' + full,
      primary: shift(base.primary, delta, 3, 0),
      secondary: shift(base.secondary, -delta * 0.7, 2, 3),
      accent: shift(base.accent, delta * 0.5, 0, 4),
      limited: true,
      hidden: false
    };
  }

  window.QBTI_THEMES = {
    get: get,
    hidden: HIDDEN,
    palettes: PALETTES
  };
})();
