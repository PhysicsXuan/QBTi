(function(){
  'use strict';
  /* 只有四种隐藏人格拥有专属限定主题；常规人格使用量子态三色。 */
  const HIDDEN = {
    freedom: { name: '苍穹脉冲', primary: [78, 176, 255], secondary: [228, 246, 255], accent: [255, 196, 76] },
    madman: { name: '裂面狂欢', primary: [146, 82, 255], secondary: [255, 74, 194], accent: [82, 242, 255] },
    einstein: { name: '粉笔星轨', primary: [255, 188, 92], secondary: [255, 242, 206], accent: [126, 218, 255] },
    jerry: { name: '奶酪轨道', primary: [255, 188, 74], secondary: [92, 244, 218], accent: [255, 242, 168] }
  };

  function get(code, suffix, hiddenKey){
    if(!hiddenKey || !HIDDEN[hiddenKey]) return null;
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

  window.QBTI_THEMES = { get: get, hidden: HIDDEN };
})();
