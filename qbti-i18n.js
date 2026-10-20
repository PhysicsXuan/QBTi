/* ============================================================
   QBTI i18n —— 8 语言包
   支持：zh-CN / zh-TW / en / es / pt / ko / ja / fr
   问卷题目完整版：zh-CN / zh-TW / en；其余语言问卷 fallback 到 en
   ============================================================ */
(function(){
  'use strict';

  const LANGS = ['zh-CN', 'zh-TW', 'en', 'es', 'pt', 'ko', 'ja', 'fr'];
  const LANG_NAMES = {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'en': 'English',
    'es': 'Español',
    'pt': 'Português',
    'ko': '한국어',
    'ja': '日本語',
    'fr': 'Français'
  };

  /* ============ 问卷题目 ============ */
  const Q_ZH_CN = {
    1: '我会对自己从未接触过的领域产生兴趣，即使我暂时不知道它有什么用。',
    2: '面对一道题目时，我经常会想到一种与课堂上讲过的方法不同的解法。',
    3: '如果原本熟悉的学习方式发生变化，我通常能够比较快地找到新的方法。',
    4: '相比于反复练习自己已经擅长的事情，我更愿意偶尔尝试完全陌生的事情。',
    5: '我认为一道题有不止一种合理的思考方式，是一件很有意思的事情。',
    6: '如果一个问题没有明确的答案，我仍然愿意花很长时间弄清楚它到底能不能被解决。',
    7: '当别人告诉我「通常应该这样做」时，我仍然会思考有没有完全不同的做法。',
    8: '如果一种原本有效的方法突然失效，我能够放弃原来的思路并重新设计解决方案。',
    9: '即使一个新领域一开始让我感到陌生甚至有些困难，我也不会因此轻易失去兴趣。',
    10: '当一个问题没有现成的方法可以套用时，我反而更容易产生自己的思路。',
    11: '当我学到一个新知识时，我通常会想知道它为什么会这样，而不仅仅是记住结论。',
    12: '如果一个主题真的让我感兴趣，我可以在没有别人要求的情况下主动花很多时间研究它。',
    13: '如果我理解了一件事情「为什么值得做」，我通常会更愿意投入时间。',
    14: '我经常会因为一个看似不起眼的问题，而产生「如果……会怎么样？」这样的想法。',
    15: '对于自己真正喜欢的事情，我通常能够保持比较长时间的兴趣。',
    16: '如果老师只告诉我一个公式，却没有解释它为什么成立，我通常会觉得这还不够。',
    17: '即使一件事情没有考试、排名或奖励，只要我认为它值得做，我仍然愿意认真完成。',
    18: '我曾经因为一个自己真正感兴趣的问题，自发地查资料、看视频或寻找其他学习资源。',
    19: '如果一项任务与我认为重要的事情没有关系，我很难长时间保持投入。',
    20: '当我真正对一个问题产生兴趣时，即使过程中不断遇到新的问题，我也会想继续追下去。',
    21: '如果没有人提醒，我通常也能够主动开始完成自己的学习任务。',
    22: '面对一个自己已经学过的内容，我通常可以不依赖老师一步一步地带着我完成。',
    23: '当学习过程中遇到暂时解决不了的问题时，我通常不会马上放弃。',
    24: '我习惯自己安排什么时候学习什么内容，而不是完全按照别人给出的安排进行。',
    25: '当别人没有告诉我下一步该做什么时，我通常也能自己找到事情继续做下去。',
    26: '如果一项任务不会计入成绩，我仍然可能因为自己想做好它而认真完成。',
    27: '当我发现老师给出的解决方法无法解决一个新问题时，我会尝试自己建立一套方法。',
    28: '如果一个目标需要持续几周甚至几个月才能完成，我仍然能够维持自己的行动。',
    29: '当我连续几次尝试都没有得到想要的结果时，我通常会重新调整方法，而不是直接停止。',
    30: '如果没有任何人监督我的进度，我仍然能够为了一个自己设定的目标持续投入。',
    31: '我并不介意暂时不知道一个问题的答案。',
    32: '面对一个明显比平时困难的任务，我通常会有兴趣尝试一下。',
    33: '一次失败并不会让我很长时间不愿意再次尝试类似的事情。',
    34: '如果一个任务没有明确的评分标准，我仍然可以比较自在地完成它。',
    35: '相比于选择一个我已经很有把握完成的任务，我有时更愿意挑战难度更高的任务。',
    36: '如果我花了很长时间仍然没有找到答案，我仍然可以接受「暂时没有答案」这种状态。',
    37: '当一个问题明显超出我目前的能力范围时，我反而会想看看自己究竟能做到什么程度。',
    38: '如果一次重要的尝试失败了，我通常能够在总结原因之后重新开始。',
    39: '在没有标准答案、没有现成步骤、甚至不知道自己是否能成功的情况下，我仍然愿意继续探索。',
    40: '越是可能失败、结果越不确定的任务，我越希望亲自试试看。'
  };

  const Q_ZH_TW = {
    1: '我會對自己從未接觸過的領域產生興趣，即使我暫時不知道它有什麼用。',
    2: '面對一道題目時，我經常會想到一種與課堂上講過的方法不同的解法。',
    3: '如果原本熟悉的學習方式發生變化，我通常能夠比較快地找到新的方法。',
    4: '相比於反覆練習自己已經擅長的事情，我更願意偶爾嘗試完全陌生的事情。',
    5: '我認為一道題有不止一種合理的思考方式，是一件很有意思的事情。',
    6: '如果一個問題沒有明確的答案，我仍然願意花很長時間弄清楚它到底能不能被解決。',
    7: '當別人告訴我「通常應該這樣做」時，我仍然會思考有沒有完全不同的做法。',
    8: '如果一種原本有效的方法突然失效，我能夠放棄原來的思路並重新設計解決方案。',
    9: '即使一個新領域一開始讓我感到陌生甚至有些困難，我也不會因此輕易失去興趣。',
    10: '當一個問題沒有現成的方法可以套用時，我反而更容易產生自己的思路。',
    11: '當我學到一個新知識時，我通常會想知道它為什麼會這樣，而不僅僅是記住結論。',
    12: '如果一個主題真的讓我感興趣，我可以在沒有別人要求的情況下主動花很多時間研究它。',
    13: '如果我理解了一件事情「為什麼值得做」，我通常會更願意投入時間。',
    14: '我經常會因為一個看似不起眼的問題，而產生「如果……會怎麼樣？」這樣的想法。',
    15: '對於自己真正喜歡的事情，我通常能夠保持比較長時間的興趣。',
    16: '如果老師只告訴我一個公式，卻沒有解釋它為什麼成立，我通常會覺得這還不夠。',
    17: '即使一件事情沒有考試、排名或獎勵，只要我認為它值得做，我仍然願意認真完成。',
    18: '我曾經因為一個自己真正感興趣的問題，自發地查資料、看影片或尋找其他學習資源。',
    19: '如果一項任務與我認為重要的事情沒有關係，我很難長時間保持投入。',
    20: '當我真正對一個問題產生興趣時，即使過程中不斷遇到新的問題，我也會想繼續追下去。',
    21: '如果沒有人提醒，我通常也能夠主動開始完成自己的學習任務。',
    22: '面對一個自己已經學過的內容，我通常可以不依賴老師一步一步地帶著我完成。',
    23: '當學習過程中遇到暫時解決不了的問題時，我通常不會馬上放棄。',
    24: '我習慣自己安排什麼時候學習什麼內容，而不是完全按照別人給出的安排進行。',
    25: '當別人沒有告訴我下一步該做什麼時，我通常也能自己找到事情繼續做下去。',
    26: '如果一項任務不會計入成績，我仍然可能因為自己想做好它而認真完成。',
    27: '當我發現老師給出的解決方法無法解決一個新問題時，我會嘗試自己建立一套方法。',
    28: '如果一個目標需要持續幾週甚至幾個月才能完成，我仍然能夠維持自己的行動。',
    29: '當我連續幾次嘗試都沒有得到想要的結果時，我通常會重新調整方法，而不是直接停止。',
    30: '如果沒有任何人的監督我的進度，我仍然能夠為了一個自己設定的目標持續投入。',
    31: '我並不介意暫時不知道一個問題的答案。',
    32: '面對一個明顯比平時困難的任務，我通常會有興趣嘗試一下。',
    33: '一次失敗並不會讓我很長時間不願意再次嘗試類似的事情。',
    34: '如果一個任務沒有明確的評分標準，我仍然可以比較自在地完成它。',
    35: '相比於選擇一個我已經很有把握完成的任務，我有時更願意挑戰難度更高的任務。',
    36: '如果我花了很長時間仍然沒有找到答案，我仍然可以接受「暫時沒有答案」這種狀態。',
    37: '當一個問題明顯超出我目前的能力範圍時，我反而會想看看自己究竟能做到什麼程度。',
    38: '如果一次重要的嘗試失敗了，我通常能夠在總結原因之後重新開始。',
    39: '在沒有標準答案、沒有現成步驟、甚至不知道自己是否能成功的情況下，我仍然願意繼續探索。',
    40: '越是可能失敗、結果越不確定的任務，我越希望親自試試看。'
  };

  const Q_EN = {
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

  const OPT_ZH_CN = ['非常不同意', '比较不同意', '不确定 / 一般', '比较同意', '非常同意'];
  const OPT_ZH_TW = ['非常不同意', '比較不同意', '不確定 / 一般', '比較同意', '非常同意'];
  const OPT_EN = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  /* ============ 后缀 / 维度 / 子维度 ============ */
  const SFX_ZH_CN = {
    E: { name: '探索型', desc: '通过不断进入新领域、新问题、新可能性来发展自己。' },
    D: { name: '深耕型', desc: '通过在一个方向上长期投入、持续深入来发展自己。' },
    I: { name: '融合型', desc: '通过连接不同知识、领域和方法来发展自己。' },
    A: { name: '实践型', desc: '通过把想法转化为具体行动、作品和成果来发展自己。' }
  };
  const SFX_ZH_TW = {
    E: { name: '探索型', desc: '透過不斷進入新領域、新問題、新可能性來發展自己。' },
    D: { name: '深耕型', desc: '透過在一個方向上長期投入、持續深入來發展自己。' },
    I: { name: '融合型', desc: '透過連接不同知識、領域和方法來發展自己。' },
    A: { name: '實踐型', desc: '透過把想法轉化為具體行動、作品和成果來發展自己。' }
  };
  const SFX_EN = {
    E: { name: 'Explorer', desc: 'Develops by continuously entering new fields, new problems, and new possibilities.' },
    D: { name: 'Deep Diver', desc: 'Develops by investing long-term and deeply in one direction.' },
    I: { name: 'Integrator', desc: 'Develops by connecting different knowledge, fields, and methods.' },
    A: { name: 'Practitioner', desc: 'Develops by turning ideas into concrete actions, works, and outcomes.' }
  };

  const DIM_ZH_CN = { PO: { name: '潜能开放度' }, II: { name: '内在驱动力' }, LA: { name: '学习自主性' }, UR: { name: '未知应对方式' } };
  const DIM_ZH_TW = { PO: { name: '潛能開放度' }, II: { name: '內在驅動力' }, LA: { name: '學習自主性' }, UR: { name: '未知應對方式' } };
  const DIM_EN = { PO: { name: 'Potential Openness' }, II: { name: 'Intrinsic Interest' }, LA: { name: 'Learning Agency' }, UR: { name: 'Uncertainty Response' } };

  const SUB_ZH_CN = { X: '探索欲', C: '创造', A: '适应', U: '好奇', P: '热情', M: '意义', I: '主动', D: '独立', E: '坚持', T: '容忍', H: '挑战', R: '韧性' };
  const SUB_ZH_TW = { X: '探索慾', C: '創造', A: '適應', U: '好奇', P: '熱情', M: '意義', I: '主動', D: '獨立', E: '堅持', T: '容忍', H: '挑戰', R: '韌性' };
  const SUB_EN = { X: 'Exploration', C: 'Creativity', A: 'Adaptation', U: 'Curiosity', P: 'Passion', M: 'Meaning', I: 'Initiative', D: 'Independence', E: 'Endurance', T: 'Tolerance', H: 'Challenge', R: 'Resilience' };

  /* ============ UI 翻译 ============ */
  const UI = {
    'zh-CN': {
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
      'result.sec3': 'AI 引导报告 · 写给你',
      'result.aiTitle': '个性化波函数解读',
      'result.aiEmpty': '点击「生成报告」，AI 将基于你的十二维量子态，输出一份只写给你自己的成长路径。',
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
      'settings.fontWeight': '字体粗细',
      'settings.fontWeight.normal': '常规', 'settings.fontWeight.bold': '粗体',
      'settings.langNote': '※ 语言切换会同步问卷题目与界面文字。',
      'settings.langPartial': '（当前语言问卷暂用英文显示）',
      'settings.reset': '恢复默认', 'settings.done': '完成'
    },
    'zh-TW': {
      'nav.home': '主頁', 'nav.qbti': 'QBTI', 'nav.contact': '聯絡我們',
      'back': '← 返回', 'backHome': '← 返回主頁', 'backQbti': '← 返回 QBTI 首頁',
      'home.hint': '按住量子球以開始',
      'intro.title': '你，<span class="grad">尚未坍縮</span>。',
      'intro.lead': '在單一的評價框架裡，每一次排名、每一張試卷，都是一次強觀測。而觀測，會讓疊加態坍縮。<br>QBTI 用 40 道題、81 種人格類型、4 個發展方向，描述那些還沒被觀測到的你。',
      'intro.start': '開始觀測 →', 'intro.history': '歷史觀測記錄',
      'quiz.quit': '← 放棄答題', 'quiz.prev': '← 上一題', 'quiz.hint': '鍵盤 1–5 可快速作答',
      'result.sec1': '四維傾向 · 每維度內三字母合計 100%',
      'result.sec2': '發展向量 Developmental Vector',
      'result.vecTitle': '你目前的學習狀態更傾向於……',
      'result.vecSub': '四條發展路徑的相對權重。',
      'result.sec3': 'AI 引導報告 · 寫給你',
      'result.aiTitle': '個性化波函數解讀',
      'result.aiEmpty': '點擊「生成報告」，AI 將基於你的十二維量子態，輸出一份只寫給你自己的成長路徑。',
      'result.restart': '重新觀測', 'result.copy': '複製結果',
      'contact.title': '聯絡我們',
      'contact.text': '如果你希望了解項目、提出建議，或者參與後續的量子態映射研究，可以透過郵件與我們聯繫。',
      'settings.title': '設定', 'settings.sub': '調整介面與量子球效果，設定會儲存在本地。',
      'settings.sectionSphere': '量子球', 'settings.sectionDisplay': '顯示',
      'settings.brightness': '亮度',
      'settings.effectsMode': '特效模式',
      'settings.effectsMode.simple': '簡潔', 'settings.effectsMode.normal': '一般',
      'settings.language': '語言',
      'settings.fontSize': '字體大小',
      'settings.fontWeight': '字體粗細',
      'settings.fontWeight.normal': '一般', 'settings.fontWeight.bold': '粗體',
      'settings.langNote': '※ 語言切換會同步問卷題目與介面文字。',
      'settings.langPartial': '（此語言的問卷暫用英文顯示）',
      'settings.reset': '恢復預設', 'settings.done': '完成'
    },
    'en': {
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
      'result.sec3': 'AI Guidance Report · For You',
      'result.aiTitle': 'Personalized Wavefunction Reading',
      'result.aiEmpty': 'Click "Generate" — AI will interpret your 12-dimensional quantum state and write a growth path just for you.',
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
      'settings.fontWeight': 'Font Weight',
      'settings.fontWeight.normal': 'Normal', 'settings.fontWeight.bold': 'Bold',
      'settings.langNote': 'Note: Switching language also changes questionnaire text.',
      'settings.langPartial': ' (questionnaire currently in English for this language)',
      'settings.reset': 'Reset', 'settings.done': 'Done'
    },
    'es': {
      'nav.home': 'Inicio', 'nav.qbti': 'QBTI', 'nav.contact': 'Contacto',
      'back': '← Volver', 'backHome': '← Inicio', 'backQbti': '← Volver a QBTI',
      'home.hint': 'Mantén presionada la esfera cuántica para comenzar',
      'intro.title': 'Tú, <span class="grad">aún sin colapsar</span>.',
      'intro.lead': 'En un marco de evaluación único, cada clasificación y cada examen son una medición fuerte. Y la medición hace colapsar la superposición.<br>QBTI usa 40 preguntas, 81 tipos de personalidad y 4 direcciones de desarrollo para describir la parte de ti que aún no ha sido observada.',
      'intro.start': 'Comenzar observación →', 'intro.history': 'Historial',
      'quiz.quit': '← Salir', 'quiz.prev': '← Anterior', 'quiz.hint': 'Pulsa 1–5 para responder',
      'result.sec1': 'Cuatro dimensiones · Suma 100%',
      'result.sec2': 'Vector de desarrollo',
      'result.vecTitle': 'Tu estado actual tiende hacia…',
      'result.vecSub': 'Peso relativo de los cuatro caminos.',
      'result.sec3': 'Informe IA · Para ti',
      'result.aiTitle': 'Lectura personalizada de la función de onda',
      'result.aiEmpty': 'Pulsa "Generar" — la IA interpretará tu estado cuántico 12D y escribirá una ruta de crecimiento solo para ti.',
      'result.restart': 'Re-observar', 'result.copy': 'Copiar',
      'contact.title': 'Contacto',
      'contact.text': 'Si deseas conocer el proyecto, dar sugerencias o participar en la investigación futura, contáctanos por correo.',
      'settings.title': 'Ajustes', 'settings.sub': 'Ajusta la interfaz y la esfera. Se guarda localmente.',
      'settings.sectionSphere': 'Esfera Cuántica', 'settings.sectionDisplay': 'Visualización',
      'settings.brightness': 'Brillo',
      'settings.effectsMode': 'Modo de efectos',
      'settings.effectsMode.simple': 'Simple', 'settings.effectsMode.normal': 'Normal',
      'settings.language': 'Idioma',
      'settings.fontSize': 'Tamaño de fuente',
      'settings.fontWeight': 'Grosor de fuente',
      'settings.fontWeight.normal': 'Normal', 'settings.fontWeight.bold': 'Negrita',
      'settings.langNote': '※ Cambiar el idioma también cambia el cuestionario.',
      'settings.langPartial': ' (cuestionario en inglés para este idioma)',
      'settings.reset': 'Restablecer', 'settings.done': 'Hecho'
    },
    'pt': {
      'nav.home': 'Início', 'nav.qbti': 'QBTI', 'nav.contact': 'Contato',
      'back': '← Voltar', 'backHome': '← Início', 'backQbti': '← Voltar ao QBTI',
      'home.hint': 'Pressione e segure a esfera quântica para começar',
      'intro.title': 'Você, <span class="grad">ainda não colapsado</span>.',
      'intro.lead': 'Em um único quadro de avaliação, cada classificação e cada prova são uma medição forte. E a medição faz colapsar a superposição.<br>O QBTI usa 40 perguntas, 81 tipos de personalidade e 4 direções de desenvolvimento para descrever a parte de você que ainda não foi observada.',
      'intro.start': 'Iniciar observação →', 'intro.history': 'Histórico',
      'quiz.quit': '← Sair', 'quiz.prev': '← Anterior', 'quiz.hint': 'Pressione 1–5 para responder',
      'result.sec1': 'Quatro dimensões · Soma 100%',
      'result.sec2': 'Vetor de desenvolvimento',
      'result.vecTitle': 'Seu estado atual tende para…',
      'result.vecSub': 'Peso relativo dos quatro caminhos.',
      'result.sec3': 'Relatório IA · Para você',
      'result.aiTitle': 'Leitura personalizada da função de onda',
      'result.aiEmpty': 'Clique em "Gerar" — a IA interpretará seu estado quântico 12D e escreverá um caminho de crescimento só para você.',
      'result.restart': 'Re-observar', 'result.copy': 'Copiar',
      'contact.title': 'Contato',
      'contact.text': 'Se desejar conhecer o projeto, dar sugestões ou participar da pesquisa futura, entre em contato por e-mail.',
      'settings.title': 'Configurações', 'settings.sub': 'Ajuste a interface e a esfera. Salvo localmente.',
      'settings.sectionSphere': 'Esfera Quântica', 'settings.sectionDisplay': 'Visualização',
      'settings.brightness': 'Brilho',
      'settings.effectsMode': 'Modo de efeitos',
      'settings.effectsMode.simple': 'Simples', 'settings.effectsMode.normal': 'Normal',
      'settings.language': 'Idioma',
      'settings.fontSize': 'Tamanho da fonte',
      'settings.fontWeight': 'Peso da fonte',
      'settings.fontWeight.normal': 'Normal', 'settings.fontWeight.bold': 'Negrito',
      'settings.langNote': '※ Trocar o idioma também altera o questionário.',
      'settings.langPartial': ' (questionário em inglês para este idioma)',
      'settings.reset': 'Redefinir', 'settings.done': 'Concluído'
    },
    'ko': {
      'nav.home': '홈', 'nav.qbti': 'QBTI', 'nav.contact': '문의',
      'back': '← 뒤로', 'backHome': '← 홈', 'backQbti': '← QBTI로',
      'home.hint': '양자 구체를 길게 눌러 시작',
      'intro.title': '당신은, <span class="grad">아직 붕괴하지 않았다</span>.',
      'intro.lead': '단일한 평가 체계에서 모든 순위와 시험지는 강한 관측입니다. 그리고 관측은 중첩 상태를 붕괴시킵니다.<br>QBTI는 40개의 질문, 81가지 성격 유형, 4개의 발전 방향으로 아직 관측되지 않은 당신을 설명합니다.',
      'intro.start': '관측 시작 →', 'intro.history': '관측 기록',
      'quiz.quit': '← 중단', 'quiz.prev': '← 이전', 'quiz.hint': '키보드 1–5로 빠르게 응답',
      'result.sec1': '4차원 경향 · 합계 100%',
      'result.sec2': '발전 벡터',
      'result.vecTitle': '현재 학습 상태는……',
      'result.vecSub': '4가지 발전 경로의 상대적 가중치.',
      'result.sec3': 'AI 가이드 리포트 · 너에게',
      'result.aiTitle': '개인화된 파동함수 해석',
      'result.aiEmpty': '"생성"을 클릭하면 AI가 너의 12차원 양자 상태를 바탕으로 너만을 위한 성장 경로를 작성합니다.',
      'result.restart': '재관측', 'result.copy': '결과 복사',
      'contact.title': '문의',
      'contact.text': '프로젝트에 대해 알고 싶거나 제안하고 싶거나 향후 연구에 참여하고 싶다면 이메일로 연락해 주세요.',
      'settings.title': '설정', 'settings.sub': '인터페이스와 양자 구체를 조정합니다. 로컬에 저장됩니다.',
      'settings.sectionSphere': '양자 구체', 'settings.sectionDisplay': '표시',
      'settings.brightness': '밝기',
      'settings.effectsMode': '효과 모드',
      'settings.effectsMode.simple': '간단', 'settings.effectsMode.normal': '일반',
      'settings.language': '언어',
      'settings.fontSize': '글자 크기',
      'settings.fontWeight': '글자 두께',
      'settings.fontWeight.normal': '보통', 'settings.fontWeight.bold': '굵게',
      'settings.langNote': '※ 언어 변경은 설문 문항과 UI에 동기화됩니다.',
      'settings.langPartial': ' (이 언어의 설문은 영어로 표시됩니다)',
      'settings.reset': '초기화', 'settings.done': '완료'
    },
    'ja': {
      'nav.home': 'ホーム', 'nav.qbti': 'QBTI', 'nav.contact': 'お問い合わせ',
      'back': '← 戻る', 'backHome': '← ホーム', 'backQbti': '← QBTI へ',
      'home.hint': '量子球を長押しして開始',
      'intro.title': 'あなたは、<span class="grad">まだ収縮していない</span>。',
      'intro.lead': '単一の評価フレームでは、順位や試験がすべて強い観測となります。そして観測は重ね合わせを収縮させます。<br>QBTI は 40 の質問、81 の性格タイプ、4 つの発展方向で、まだ観測されていないあなたを描きます。',
      'intro.start': '観測を始める →', 'intro.history': '観測履歴',
      'quiz.quit': '← 中止', 'quiz.prev': '← 前へ', 'quiz.hint': 'キーボード 1–5 で素早く回答',
      'result.sec1': '四つの次元 · 各合計 100%',
      'result.sec2': '発展ベクトル',
      'result.vecTitle': '現在の学習状態は……',
      'result.vecSub': '4 つの発展経路の相対的な重み。',
      'result.sec3': 'AI ガイダンス · あなたへ',
      'result.aiTitle': 'パーソナライズされた波動関数',
      'result.aiEmpty': '「生成」をクリックすると、AI があなたの12次元量子状態をもとに、あなただけの成長の道筋を書きます。',
      'result.restart': '再観測', 'result.copy': 'コピー',
      'contact.title': 'お問い合わせ',
      'contact.text': 'プロジェクトについて知りたい、提案したい、または今後の研究に参加したい場合は、メールでご連絡ください。',
      'settings.title': '設定', 'settings.sub': 'インターフェースと量子球を調整します。ローカルに保存されます。',
      'settings.sectionSphere': '量子球', 'settings.sectionDisplay': '表示',
      'settings.brightness': '明るさ',
      'settings.effectsMode': 'エフェクトモード',
      'settings.effectsMode.simple': 'シンプル', 'settings.effectsMode.normal': '標準',
      'settings.language': '言語',
      'settings.fontSize': '文字サイズ',
      'settings.fontWeight': '文字の太さ',
      'settings.fontWeight.normal': '標準', 'settings.fontWeight.bold': '太字',
      'settings.langNote': '※ 言語切替はアンケートと UI に同期します。',
      'settings.langPartial': '（この言語のアンケートは英語で表示されます）',
      'settings.reset': 'リセット', 'settings.done': '完了'
    },
    'fr': {
      'nav.home': 'Accueil', 'nav.qbti': 'QBTI', 'nav.contact': 'Contact',
      'back': '← Retour', 'backHome': '← Accueil', 'backQbti': '← Retour à QBTI',
      'home.hint': 'Maintenez la sphère quantique pour commencer',
      'intro.title': 'Vous, <span class="grad">pas encore effondré</span>.',
      'intro.lead': 'Dans un cadre d\'évaluation unique, chaque classement et chaque examen sont une mesure forte. Et la mesure fait s\'effondrer la superposition.<br>QBTI utilise 40 questions, 81 types de personnalité et 4 directions de développement pour décrire la partie de vous qui n\'a pas encore été observée.',
      'intro.start': 'Commencer l\'observation →', 'intro.history': 'Historique',
      'quiz.quit': '← Quitter', 'quiz.prev': '← Précédent', 'quiz.hint': 'Touches 1 à 5 pour répondre rapidement',
      'result.sec1': 'Quatre dimensions · Chacune = 100%',
      'result.sec2': 'Vecteur de développement',
      'result.vecTitle': 'Votre état d\'apprentissage actuel tend vers…',
      'result.vecSub': 'Poids relatifs des quatre chemins.',
      'result.sec3': 'Rapport IA · Pour toi',
      'result.aiTitle': 'Lecture personnalisée de la fonction d\'onde',
      'result.aiEmpty': 'Cliquez sur « Générer » — l\'IA interprétera ton état quantique 12D et écrira un parcours de croissance rien que pour toi.',
      'result.restart': 'Réobserver', 'result.copy': 'Copier',
      'contact.title': 'Contact',
      'contact.text': 'Si vous souhaitez en savoir plus sur le projet, faire des suggestions ou participer à la recherche future, contactez-nous par email.',
      'settings.title': 'Paramètres', 'settings.sub': 'Ajustez l\'interface et la sphère. Sauvegardé localement.',
      'settings.sectionSphere': 'Sphère Quantique', 'settings.sectionDisplay': 'Affichage',
      'settings.brightness': 'Luminosité',
      'settings.effectsMode': 'Mode d\'effets',
      'settings.effectsMode.simple': 'Simple', 'settings.effectsMode.normal': 'Normal',
      'settings.language': 'Langue',
      'settings.fontSize': 'Taille de police',
      'settings.fontWeight': 'Graisse de police',
      'settings.fontWeight.normal': 'Normale', 'settings.fontWeight.bold': 'Gras',
      'settings.langNote': '※ Changer la langue change aussi le questionnaire.',
      'settings.langPartial': ' (questionnaire en anglais pour cette langue)',
      'settings.reset': 'Réinitialiser', 'settings.done': 'Terminé'
    }
  };

  const LANG_PACK = {
    'zh-CN': { q: Q_ZH_CN, opt: OPT_ZH_CN, sfx: SFX_ZH_CN, dim: DIM_ZH_CN, sub: SUB_ZH_CN, fullQuestion: true },
    'zh-TW': { q: Q_ZH_TW, opt: OPT_ZH_TW, sfx: SFX_ZH_TW, dim: DIM_ZH_TW, sub: SUB_ZH_TW, fullQuestion: true },
    'en':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: true },
    'es':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: false },
    'pt':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: false },
    'ko':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: false },
    'ja':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: false },
    'fr':    { q: Q_EN,    opt: OPT_EN,    sfx: SFX_EN,    dim: DIM_EN,    sub: SUB_EN,    fullQuestion: false }
  };

  const api = {
    LANGS: LANGS,
    LANG_NAMES: LANG_NAMES,
    current: 'zh-CN',
    set(lang){
      if(LANGS.indexOf(lang) < 0) lang = 'zh-CN';
      this.current = lang;
      document.documentElement.lang = (lang === 'zh-CN') ? 'zh-CN' : (lang === 'zh-TW' ? 'zh-TW' : lang);
      return lang;
    },
    t(key){
      const d = UI[this.current] || UI['zh-CN'];
      return d[key] != null ? d[key] : (UI['zh-CN'][key] != null ? UI['zh-CN'][key] : key);
    },
    q(qId){
      const p = LANG_PACK[this.current] || LANG_PACK['zh-CN'];
      return p.q[qId] || '';
    },
    opt(i){
      const p = LANG_PACK[this.current] || LANG_PACK['zh-CN'];
      return p.opt[i] || '';
    },
    sfx(letter, field){
      const p = LANG_PACK[this.current] || LANG_PACK['zh-CN'];
      const s = p.sfx[letter];
      return s ? (s[field] || '') : '';
    },
    dim(dimId, field){
      const p = LANG_PACK[this.current] || LANG_PACK['zh-CN'];
      const d = p.dim[dimId];
      return d ? (d[field] || '') : '';
    },
    sub(subId){
      const p = LANG_PACK[this.current] || LANG_PACK['zh-CN'];
      return p.sub[subId] || '';
    },
    hasFullQuestion(){
      const p = LANG_PACK[this.current];
      return !!(p && p.fullQuestion);
    },
    apply(rootEl){
      const dict = UI[this.current] || UI['zh-CN'];
      const root = rootEl || document;
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = dict[key] != null ? dict[key] : UI['zh-CN'][key];
        if(val == null) return;
        if(val.indexOf('<') >= 0) el.innerHTML = val;
        else el.textContent = val;
      });
    }
  };

  window.QBTI_I18N = api;
})();