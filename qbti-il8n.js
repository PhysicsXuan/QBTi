/* ============================================================
   QBTI i18n —— 多语言包（UI + 问卷 + 选项 + 后缀 + 维度）
   支持：zh / en / ja / ko
   问卷题目仅 zh/en 完整，ja/ko 时 fallback 到 en（UI 仍为对应语言）
   ============================================================ */
(function(){
  'use strict';

  const LANGS = ['zh', 'en', 'ja', 'ko'];
  const LANG_NAMES = { zh: '中文', en: 'English', ja: '日本語', ko: '한국어' };

  const ui = {
    zh: {
      'nav.home': '主页', 'nav.qbti': 'QBTI', 'nav.contact': '联系我们',
      'back': '← 返回', 'backHome': '← 返回主页', 'backQbti': '← 返回 QBTI 首页',
      'home.hint': '按住量子球以开始',
      'intro.title': '你，<span class="grad">尚未坍缩</span>。',
      'intro.lead': '在单一的评价框架里，每一次排名、每一张试卷，都是一次强观测。而观测，会让叠加态坍缩。<br>QBTI 用 40 道题、81 种人格类型、4 个发展方向，描述那些还没被观测到的你。',
      'intro.start': '开始观测 →', 'intro.history': '历史观测记录',
      'quiz.quit': '← 放弃答题', 'quiz.prev': '← 上一题', 'quiz.hint': '键盘 1–5 可快速作答',
      'result.sec1': '四维倾向 · 每维度内三字母合计 100%',
      'result.sec2': '发展向量 Developmental Vector',
      'result.vecTitle': '你当前的学习状态更倾向于……',
      'result.vecSub': '四条发展路径的相对权重。',
      'result.sec3': 'AI 引导报告 · 面向家长',
      'result.aiTitle': '个性化波函数解读',
      'result.aiEmpty': '点击「生成报告」，AI 将基于孩子的十二维量子态与作答真实性，输出一份面向家长的引导路径。',
      'result.restart': '重新观测', 'result.copy': '复制结果',
      'contact.title': '联系我们',
      'contact.text': '如果你希望了解项目、提出建议，或者参与后续的量子态映射研究，可以通过邮件与我们联系。',
      'settings.title': '设置', 'settings.sub': '调整界面与量子球效果，设置会保存在本地。',
      'settings.sectionSphere': '量子球', 'settings.sectionDisplay': '显示',
      'settings.brightness': '亮度',
      'settings.effectsMode': '特效模式',
      'settings.effectsMode.simple': '简洁', 'settings.effectsMode.normal': '常规',
      'settings.language': '语言',
      'settings.fontSize': '字体大小',
      'settings.fontSize.sm': '小', 'settings.fontSize.md': '中', 'settings.fontSize.lg': '大',
      'settings.fontWeight': '字体粗细',
      'settings.fontWeight.normal': '常规', 'settings.fontWeight.bold': '粗体',
      'settings.langNote': '※ 语言切换会同步问卷题目与界面文字。日/韩语下问卷题目暂用英文显示。',
      'settings.reset': '恢复默认', 'settings.done': '完成'
    },
    en: {
      'nav.home': 'Home', 'nav.qbti': 'QBTI', 'nav.contact': 'Contact',
      'back': '← Back', 'backHome': '← Home', 'backQbti': '← Back to QBTI',
      'home.hint': 'Press and hold the quantum sphere to start',
      'intro.title': 'You, <span class="grad">not yet collapsed</span>.',
      'intro.lead': 'In a single evaluation framework, every ranking and every exam paper is a strong measurement. And measurement collapses superposition.<br>QBTI uses 40 questions, 81 personality types, and 4 development directions to describe the parts of you that have not been observed yet.',
      'intro.start': 'Begin observation →', 'intro.history': 'Observation history',
      'quiz.quit': '← Quit', 'quiz.prev': '← Previous', 'quiz.hint': 'Press 1–5 to answer quickly',
      'result.sec1': 'Four Dimensions · Each sums to 100%',
      'result.sec2': 'Developmental Vector',
      'result.vecTitle': 'Your current learning state leans toward…',
      'result.vecSub': 'Relative weights of the four development paths.',
      'result.sec3': 'AI Guidance Report · For Parents',
      'result.aiTitle': 'Personalized Wavefunction Reading',
      'result.aiEmpty': 'Click "Generate" — AI will interpret the child\'s 12-dimensional quantum state and response authenticity for parents.',
      'result.restart': 'Re-observe', 'result.copy': 'Copy Result',
      'contact.title': 'Contact',
      'contact.text': 'If you would like to learn about the project, offer suggestions, or participate in future quantum-state mapping research, please reach out via email.',
      'settings.title': 'Settings', 'settings.sub': 'Adjust interface and quantum sphere. Settings are saved locally.',
      'settings.sectionSphere': 'Quantum Sphere', 'settings.sectionDisplay': 'Display',
      'settings.brightness': 'Brightness',
      'settings.effectsMode': 'Effects Mode',
      'settings.effectsMode.simple': 'Simple', 'settings.effectsMode.normal': 'Normal',
      'settings.language': 'Language',
      'settings.fontSize': 'Font Size',
      'settings.fontSize.sm': 'S', 'settings.fontSize.md': 'M', 'settings.fontSize.lg': 'L',
      'settings.fontWeight': 'Font Weight',
      'settings.fontWeight.normal': 'Normal', 'settings.fontWeight.bold': 'Bold',
      'settings.langNote': 'Note: Language also switches questionnaire text. Under Japanese/Korean, questionnaire uses English.',
      'settings.reset': 'Reset', 'settings.done': 'Done'
    },
    ja: {
      'nav.home': 'ホーム', 'nav.qbti': 'QBTI', 'nav.contact': 'お問い合わせ',
      'back': '← 戻る', 'backHome': '← ホーム', 'backQbti': '← QBTI に戻る',
      'home.hint': '量子球を長押しして開始',
      'intro.title': 'あなたは、<span class="grad">まだ収縮していない</span>。',
      'intro.lead': '単一の評価フレームでは、順位や試験がすべて強い観測となります。そして観測は重ね合わせを収縮させます。<br>QBTI は 40 の質問、81 の性格タイプ、4 つの発展方向で、まだ観測されていないあなたを描きます。',
      'intro.start': '観測を始める →', 'intro.history': '観測履歴',
      'quiz.quit': '← 中止', 'quiz.prev': '← 前へ', 'quiz.hint': 'キーボード 1–5 で素早く回答',
      'result.sec1': '四つの次元 · 各次元の合計は 100%',
      'result.sec2': '発展ベクトル',
      'result.vecTitle': '現在の学習状態は……',
      'result.vecSub': '4 つの発展経路の相対的な重み。',
      'result.sec3': 'AI ガイダンスレポート · 保護者向け',
      'result.aiTitle': 'パーソナライズされた波動関数',
      'result.aiEmpty': '「生成」をクリックすると、AI がお子さまの 12 次元量子状態と回答の真実性に基づき、保護者向けのガイダンスを出力します。',
      'result.restart': '再観測', 'result.copy': 'コピー',
      'contact.title': 'お問い合わせ',
      'contact.text': 'プロジェクトについて知りたい、提案したい、あるいは今後の量子状態マッピング研究に参加したい場合は、メールでご連絡ください。',
      'settings.title': '設定', 'settings.sub': 'インターフェースと量子球を調整します。設定はローカルに保存されます。',
      'settings.sectionSphere': '量子球', 'settings.sectionDisplay': '表示',
      'settings.brightness': '明るさ',
      'settings.effectsMode': 'エフェクトモード',
      'settings.effectsMode.simple': 'シンプル', 'settings.effectsMode.normal': '標準',
      'settings.language': '言語',
      'settings.fontSize': '文字サイズ',
      'settings.fontSize.sm': '小', 'settings.fontSize.md': '中', 'settings.fontSize.lg': '大',
      'settings.fontWeight': '文字の太さ',
      'settings.fontWeight.normal': '標準', 'settings.fontWeight.bold': '太字',
      'settings.langNote': '※ 言語切替はアンケートと UI に同期します。日本語/韓国語の場合、アンケートは英語で表示されます。',
      'settings.reset': 'リセット', 'settings.done': '完了'
    },
    ko: {
      'nav.home': '홈', 'nav.qbti': 'QBTI', 'nav.contact': '문의하기',
      'back': '← 뒤로', 'backHome': '← 홈', 'backQbti': '← QBTI로 돌아가기',
      'home.hint': '양자 구체를 길게 눌러 시작',
      'intro.title': '당신은, <span class="grad">아직 붕괴하지 않았다</span>.',
      'intro.lead': '단일한 평가 체계에서 모든 순위와 시험지는 강한 관측입니다. 그리고 관측은 중첩 상태를 붕괴시킵니다.<br>QBTI는 40개의 질문, 81가지 성격 유형, 4개의 발전 방향으로 아직 관측되지 않은 당신을 설명합니다.',
      'intro.start': '관측 시작 →', 'intro.history': '관측 기록',
      'quiz.quit': '← 중단', 'quiz.prev': '← 이전', 'quiz.hint': '키보드 1–5로 빠르게 응답',
      'result.sec1': '4차원 경향 · 각 차원 합계 100%',
      'result.sec2': '발전 벡터',
      'result.vecTitle': '현재 학습 상태는……',
      'result.vecSub': '4가지 발전 경로의 상대적 가중치.',
      'result.sec3': 'AI 가이드 리포트 · 학부모용',
      'result.aiTitle': '개인화된 파동함수 해석',
      'result.aiEmpty': '"생성"을 클릭하면 AI가 자녀의 12차원 양자 상태와 응답 진실성을 바탕으로 학부모용 가이드를 생성합니다.',
      'result.restart': '재관측', 'result.copy': '결과 복사',
      'contact.title': '문의하기',
      'contact.text': '프로젝트에 대해 알고 싶거나 제안하고 싶거나 향후 양자 상태 매핑 연구에 참여하고 싶다면 이메일로 연락해 주세요.',
      'settings.title': '설정', 'settings.sub': '인터페이스와 양자 구체를 조정합니다. 설정은 로컬에 저장됩니다.',
      'settings.sectionSphere': '양자 구체', 'settings.sectionDisplay': '표시',
      'settings.brightness': '밝기',
      'settings.effectsMode': '효과 모드',
      'settings.effectsMode.simple': '간단', 'settings.effectsMode.normal': '일반',
      'settings.language': '언어',
      'settings.fontSize': '글자 크기',
      'settings.fontSize.sm': '소', 'settings.fontSize.md': '중', 'settings.fontSize.lg': '대',
      'settings.fontWeight': '글자 두께',
      'settings.fontWeight.normal': '보통', 'settings.fontWeight.bold': '굵게',
      'settings.langNote': '※ 언어 변경은 설문 문항과 UI에 동기화됩니다. 일본어/한국어의 경우 설문은 영어로 표시됩니다.',
      'settings.reset': '초기화', 'settings.done': '완료'
    }
  };

  /* 问卷题目（英文完整 40 题） */
  const q_en = {
    1: 'I get interested in areas I have never encountered, even if I do not yet know what they are for.',
    2: 'When facing a problem, I often think of a solution different from what was taught in class.',
    3: 'If my usual way of learning changes, I can usually find a new method fairly quickly.',
    4: 'Rather than repeatedly practicing what I am already good at, I would prefer to occasionally try something completely unfamiliar.',
    5: 'I find it interesting that a problem can have more than one reasonable way of thinking about it.',
    6: 'If a problem has no clear answer, I am still willing to spend a long time figuring out whether it can be solved at all.',
    7: 'When someone tells me "this is usually how it is done", I still wonder if there is a completely different way.',
    8: 'If a previously effective method suddenly stops working, I can abandon the original approach and redesign a solution.',
    9: 'Even if a new field feels unfamiliar or even a bit difficult at first, I will not easily lose interest because of it.',
    10: 'When a problem has no ready-made method to apply, I actually find it easier to come up with my own ideas.',
    11: 'When I learn something new, I usually want to know why it works that way, not just memorize the conclusion.',
    12: 'If a topic really interests me, I can actively spend a lot of time researching it without anyone asking.',
    13: 'If I understand why something is worth doing, I am usually more willing to invest time in it.',
    14: 'I often have "what if...?" thoughts triggered by seemingly trivial questions.',
    15: 'For things I truly enjoy, I can usually maintain interest for a fairly long time.',
    16: 'If a teacher only gives me a formula without explaining why it holds, I usually feel that is not enough.',
    17: 'Even if something has no exam, ranking, or reward, as long as I think it is worth doing, I am still willing to do it seriously.',
    18: 'I have spontaneously searched for materials, watched videos, or looked for other learning resources because of a question that genuinely interested me.',
    19: 'If a task has nothing to do with what I consider important, it is hard for me to stay engaged for long.',
    20: 'When I am truly interested in a problem, I want to keep pursuing it even if new questions keep arising along the way.',
    21: 'Even without reminders, I can usually start my own learning tasks on my own initiative.',
    22: 'For content I have already learned, I can usually complete it without the teacher guiding me step by step.',
    23: 'When I encounter a problem I cannot solve for now during learning, I usually do not give up immediately.',
    24: 'I am used to arranging when and what I study myself, rather than following exactly what others have arranged.',
    25: 'When no one tells me what to do next, I can usually find something to keep going on my own.',
    26: 'If a task will not count toward my grade, I may still do it seriously because I want to do it well.',
    27: 'When I find that the teacher\'s method cannot solve a new problem, I will try to build my own approach.',
    28: 'If a goal takes weeks or even months to complete, I can still sustain my action toward it.',
    29: 'When several attempts in a row do not get the results I want, I usually readjust my approach instead of just stopping.',
    30: 'Without anyone supervising my progress, I can still keep investing in a goal I have set for myself.',
    31: 'I do not mind not knowing the answer to a problem for a while.',
    32: 'I am usually interested in trying a task that is clearly harder than usual.',
    33: 'A failure will not keep me from trying similar things again for a long time.',
    34: 'If a task has no clear grading criteria, I can still complete it fairly comfortably.',
    35: 'Rather than choosing a task I am confident I can complete, I sometimes prefer to challenge myself with a harder one.',
    36: 'If I have spent a long time without finding an answer, I can still accept the state of "no answer for now".',
    37: 'When a problem is clearly beyond my current ability, I actually want to see how far I can go.',
    38: 'If an important attempt fails, I can usually start over after reviewing what happened.',
    39: 'Without a standard answer, ready-made steps, or even knowing whether I will succeed, I am still willing to keep exploring.',
    40: 'The more likely a task is to fail and the more uncertain the outcome, the more I want to try it myself.'
  };
  const opt_en = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  const sfx_en = {
    E: { name: 'Explorer', desc: 'Develops by continuously entering new fields, new problems, and new possibilities.' },
    D: { name: 'Deep Diver', desc: 'Develops by investing long-term and deeply in one direction.' },
    I: { name: 'Integrator', desc: 'Develops by connecting different knowledge, fields, and methods.' },
    A: { name: 'Practitioner', desc: 'Develops by turning ideas into concrete actions, works, and outcomes.' }
  };

  const dim_en = {
    PO: { name: 'Potential Openness' },
    II: { name: 'Intrinsic Interest' },
    LA: { name: 'Learning Agency' },
    UR: { name: 'Uncertainty Response' }
  };

  const sub_en = {
    X: 'Exploration', C: 'Creativity', A: 'Adaptation',
    U: 'Curiosity', P: 'Passion', M: 'Meaning',
    I: 'Initiative', D: 'Independence', E: 'Endurance',
    T: 'Tolerance', H: 'Challenge', R: 'Resilience'
  };

  const api = {
    LANGS: LANGS,
    LANG_NAMES: LANG_NAMES,
    current: 'zh',
    set: function(lang){
      if(LANGS.indexOf(lang) < 0) lang = 'zh';
      this.current = lang;
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
      return lang;
    },
    t: function(key){
      const d = ui[this.current] || ui.zh;
      const v = d[key];
      return v != null ? v : (ui.zh[key] != null ? ui.zh[key] : key);
    },
    q: function(qId){
      const Q = window.QBTI;
      const zhQ = Q && Q.QUESTIONS ? Q.QUESTIONS.find(x => x.id === qId) : null;
      if(this.current === 'zh' || !q_en[qId]) return zhQ ? zhQ.text : '';
      return q_en[qId];
    },
    opt: function(i){
      const Q = window.QBTI;
      const zhO = Q && Q.OPTIONS ? Q.OPTIONS[i] : null;
      if(this.current === 'zh' || !opt_en[i]) return zhO ? zhO.t : '';
      return opt_en[i];
    },
    sfx: function(letter, field){
      const Q = window.QBTI;
      if(this.current === 'zh' || !sfx_en[letter]){
        const s = Q && Q.SUFFIXES ? Q.SUFFIXES.find(x => x.letter === letter) : null;
        return s ? s[field] : '';
      }
      return sfx_en[letter][field] || '';
    },
    dim: function(dimId, field){
      const Q = window.QBTI;
      if(this.current === 'zh' || !dim_en[dimId]){
        const d = Q && Q.DIMS ? Q.DIMS.find(x => x.id === dimId) : null;
        return d ? d[field] : '';
      }
      return dim_en[dimId][field] || '';
    },
    sub: function(subId){
      const Q = window.QBTI;
      if(this.current === 'zh' || !sub_en[subId]){
        const s = Q && Q.SUBDIMS ? Q.SUBDIMS.find(x => x.id === subId) : null;
        return s ? s.name : '';
      }
      return sub_en[subId] || '';
    },
    apply: function(rootEl){
      const dict = ui[this.current] || ui.zh;
      const root = rootEl || document;
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = dict[key] != null ? dict[key] : ui.zh[key];
        if(val == null) return;
        if(val.indexOf('<') >= 0) el.innerHTML = val;
        else el.textContent = val;
      });
    }
  };

  window.QBTI_I18N = api;
})();