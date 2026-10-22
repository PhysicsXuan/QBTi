(function(){
  'use strict';

  const TRAITS = ['freedom', 'madman', 'einstein', 'jerry'];

  const PACKS = {
    'zh-CN': {
      ui: {
        kicker: '第五维度',
        title: '深渊回响',
        sub: '极端数据触发了隐藏观测。完成 10 道题，系统才会判断是否显形。',
        progress: '第 {n} / 10 题',
        scores: '特质回响',
        fifth: '第五维度 · 深渊回响'
      },
      types: {
        freedom: { name: '自由高达', subtitle: '自由主义 · 反叛 · 绝对力量', desc: '你拒绝被定义，也拒绝被规训。规则若挡路，就连规则一起打碎。' },
        madman: { name: '疯子', subtitle: '无尽求知 · 剥离人性 · 纯粹真理', desc: '你不在乎代价是否合理，只在乎答案是否存在。' },
        einstein: { name: '爱因斯坦', subtitle: '极致创造 · 推理 · 上帝视角', desc: '你习惯站到系统之外，看穿结构，再重写规则。' },
        jerry: { name: '杰瑞鼠', subtitle: '韧性 · 狡猾 · 生存智慧', desc: '你打不死、骗得过，也总能从缝隙里活下来。' }
      },
      questions: [
        { q: '如果有一天你醒来，发现世界其实是由一套极其简陋的代码构成的虚拟程序，你的第一反应是？', options: ['找到后门，把管理员踢出去，我来定规矩。', '扒开源码，我倒要看看是谁写的这堆屎山代码。', '这不重要，我只想知道引力常数能不能改。', '伪装成 NPC，看看哪个傻子能发现我。'] },
        { q: '面对一个极其繁琐、需要耗费你一生时间去解开的世纪难题，你会？', options: ['掀桌子。既然解不开，我就把它连题带桌子一起炸了。', '毫不犹豫地扎进去，就算最后疯了，我也要死在真理手里。', '换个维度思考，这题的底层逻辑可能从一开始就错了。', '先放一边，睡一觉，反正总有别人比我更急。'] },
        { q: '如果你拥有了一项可以随意穿梭时空的超能力，你最想做的是？', options: ['去把所有独裁者和暴君按在抽水马桶里。', '去未来偷看所有未解之谜的答案。', '回到过去，看看宇宙大爆炸前一秒到底发生了什么。', '回到昨天，把那个没发挥好的吵架重新吵一遍。'] },
        { q: '在团队合作中，最让你感到不可忍受的是？', options: ['有人对我的行动指手画脚，试图控制我。', '一群乌合之众在讨论毫无深度的常识问题。', '整个团队都没有人具备真正的逻辑推导能力。', '猪队友不仅帮不上忙，还把锅全扣我头上。'] },
        { q: '如果为了拯救世界，你必须剥夺自己所有的情感（包括爱、快乐和悲伤），你愿意吗？', options: ['凭什么是我？既然世界要毁灭，那就一起毁灭。', '太好了。情感只会影响我拔剑的速度和思考的纯粹。', '情感只是多巴胺和激素的分泌物，舍弃它并不影响宇宙运转。', '先假装答应，找找有没有卡系统 Bug 的方法保留一点情感。'] },
        { q: '你如何看待“规则”这个东西？', options: ['规则，就是用来被强者打碎的。', '规则是弱者为了自我保护而创造的安慰剂。', '规则是这个世界运行算法的一部分，可以被利用和重构。', '规则是我的掩体。在规则里偷偷搞事最安全。'] },
        { q: '你更喜欢以下哪一句墓志铭？', options: ['“他来过，他砸烂了这里，他自由了。”', '“他终于得到了他渴望已久的、绝对的寂静。”', '“他解答了这道题，现在他去解答下一道了。”', '“连死神都被他骗过去了，他现在在别处吃奶酪。”'] },
        { q: '遇到一个你无论如何都打不过的超级反派，你会？', options: ['像疯狗一样咬住他不放，就算自爆也要带走他半条命。', '告诉他世界是个虚无的幻影，让他陷入逻辑崩溃。', '分析他的弱点、地形、物理法则，制造一个必杀局。', '投降，然后在他手下当个二把手，找机会背刺他。'] },
        { q: '对你来说，世界上最美妙的音乐是？', options: ['镣铐被砸碎、高墙倒塌的轰鸣声。', '宇宙深空中，粒子碰撞发出的绝对安静的嘶鸣。', '钢笔在草稿纸上推导出完美公式时，笔尖的沙沙声。', '捕鼠夹合上，但里面空空如也时，猎人气急败坏的怒骂声。'] },
        { q: '（终局拷问）如果现在要你向系统提一个要求，你会提？', options: ['给我足够的火力。', '给我无上的智慧。', '给我全知全能的上帝视角。', '给我重来一次的机会。'] }
      ]
    },
    'zh-TW': {
      ui: {
        kicker: '第五維度',
        title: '深淵迴響',
        sub: '極端數據觸發了隱藏觀測。完成 10 道題，系統才會判斷是否顯形。',
        progress: '第 {n} / 10 題',
        scores: '特質迴響',
        fifth: '第五維度 · 深淵迴響'
      },
      types: {
        freedom: { name: '自由鋼彈', subtitle: '自由主義 · 反叛 · 絕對力量', desc: '你拒絕被定義，也拒絕被規訓。規則若擋路，就連規則一起打碎。' },
        madman: { name: '瘋子', subtitle: '無盡求知 · 剝離人性 · 純粹真理', desc: '你不在乎代價是否合理，只在乎答案是否存在。' },
        einstein: { name: '愛因斯坦', subtitle: '極致創造 · 推理 · 上帝視角', desc: '你習慣站到系統之外，看穿結構，再重寫規則。' },
        jerry: { name: '傑瑞鼠', subtitle: '韌性 · 狡猾 · 生存智慧', desc: '你打不死、騙得過，也總能從縫隙裡活下來。' }
      },
      questions: [
        { q: '如果有一天你醒來，發現世界其實是由一套極其簡陋的程式碼構成的虛擬程式，你的第一反應是？', options: ['找到後門，把管理員踢出去，我來定規矩。', '扒開原始碼，我倒要看看是誰寫的這堆屎山程式碼。', '這不重要，我只想知道重力常數能不能改。', '偽裝成 NPC，看看哪個傻子能發現我。'] },
        { q: '面對一個極其繁瑣、需要耗費你一生時間去解開的世紀難題，你會？', options: ['掀桌子。既然解不開，我就把它連題帶桌子一起炸了。', '毫不猶豫地扎進去，就算最後瘋了，我也要死在真理手裡。', '換個維度思考，這題的底層邏輯可能從一開始就錯了。', '先放一邊，睡一覺，反正總有別人比我更急。'] },
        { q: '如果你擁有一項可以隨意穿梭時空的超能力，你最想做的是？', options: ['去把所有獨裁者和暴君按在抽水馬桶裡。', '去未來偷看所有未解之謎的答案。', '回到過去，看看宇宙大爆炸前一秒到底發生了什麼。', '回到昨天，把那個沒發揮好的吵架重新吵一遍。'] },
        { q: '在團隊合作中，最讓你感到不可忍受的是？', options: ['有人對我的行動指手畫腳，試圖控制我。', '一群烏合之眾在討論毫無深度的常識問題。', '整個團隊都沒有人具備真正的邏輯推導能力。', '豬隊友不僅幫不上忙，還把鍋全扣我頭上。'] },
        { q: '如果為了拯救世界，你必須剝奪自己所有的情感（包括愛、快樂和悲傷），你願意嗎？', options: ['憑什麼是我？既然世界要毀滅，那就一起毀滅。', '太好了。情感只會影響我拔劍的速度和思考的純粹。', '情感只是多巴胺和激素的分泌物，捨棄它並不影響宇宙運轉。', '先假裝答應，找找有沒有卡系統 Bug 的方法保留一點情感。'] },
        { q: '你如何看待「規則」這個東西？', options: ['規則，就是用來被強者打碎的。', '規則是弱者為了自我保護而創造的安慰劑。', '規則是這個世界運行演算法的一部分，可以被利用和重構。', '規則是我的掩體。在規則裡偷偷搞事最安全。'] },
        { q: '你更喜歡以下哪一句墓誌銘？', options: ['「他來過，他砸爛了這裡，他自由了。」', '「他終於得到了他渴望已久的、絕對的寂靜。」', '「他解答了這道題，現在他去解答下一道了。」', '「連死神都被他騙過去了，他現在在別處吃起司。」'] },
        { q: '遇到一個你無論如何都打不過的超級反派，你會？', options: ['像瘋狗一樣咬住他不放，就算自爆也要帶走他半條命。', '告訴他世界是個虛無的幻影，讓他陷入邏輯崩潰。', '分析他的弱點、地形、物理法則，製造一個必殺局。', '投降，然後在他手下當個二把手，找機會背刺他。'] },
        { q: '對你來說，世界上最美妙的音樂是？', options: ['鐐銬被砸碎、高牆倒塌的轟鳴聲。', '宇宙深空中，粒子碰撞發出的絕對安靜的嘶鳴。', '鋼筆在草稿紙上推導出完美公式時，筆尖的沙沙聲。', '捕鼠夾合上，但裡面空空如也時，獵人氣急敗壞的怒罵聲。'] },
        { q: '（終局拷問）如果現在要你向系統提一個要求，你會提？', options: ['給我足夠的火力。', '給我無上的智慧。', '給我全知全能的上帝視角。', '給我重來一次的機會。'] }
      ]
    },
    en: {
      ui: {
        kicker: 'FIFTH DIMENSION',
        title: 'Abyssal Echo',
        sub: 'Extreme data has triggered a hidden observation. Complete 10 questions and the system will decide whether it takes form.',
        progress: 'Question {n} / 10',
        scores: 'Trait echoes',
        fifth: 'Fifth Dimension · Abyssal Echo'
      },
      types: {
        freedom: { name: 'Freedom GUNDAM', subtitle: 'Liberty · Rebellion · Absolute Power', desc: 'You refuse to be defined or disciplined. If a rule stands in your way, you break the rule with it.' },
        madman: { name: 'The Madman', subtitle: 'Infinite curiosity · Humanity stripped · Pure truth', desc: 'You do not care whether the cost is reasonable. You only care whether the answer exists.' },
        einstein: { name: 'Einstein', subtitle: 'Radical creativity · Reasoning · God’s-eye view', desc: 'You step outside the system, see its structure, and rewrite the rules.' },
        jerry: { name: 'Jerry', subtitle: 'Resilience · Cunning · Survival wisdom', desc: 'You cannot be killed, you can be fooled, and you always survive through the cracks.' }
      },
      questions: [
        { q: 'If you woke up and discovered the world is a very badly written simulation, what is your first reaction?', options: ['Find the back door, kick out the admin, and make the rules myself.', 'Tear open the source code. I want to see who wrote this pile of garbage.', 'That does not matter. I only want to know whether the gravitational constant can be changed.', 'Pretend to be an NPC and see which idiot notices me.'] },
        { q: 'Faced with an impossibly tedious century-old problem that could take your whole life, what do you do?', options: ['Flip the table. If I cannot solve it, I will blow up the problem and the table together.', 'Dive in without hesitation. Even if I go mad, I want to die in the hands of truth.', 'Change dimensions. The underlying logic may have been wrong from the start.', 'Put it aside and sleep. Someone else will be more impatient than me.'] },
        { q: 'If you had the power to travel through time at will, what would you most want to do?', options: ['Shove every dictator and tyrant headfirst into a toilet.', 'Jump to the future and peek at the answers to every unsolved mystery.', 'Go back to one second before the Big Bang and see what actually happened.', 'Go back to yesterday and redo an argument I handled badly.'] },
        { q: 'In teamwork, what is the most unbearable thing for you?', options: ['Someone bosses me around and tries to control my actions.', 'A crowd of people discussing shallow common-sense questions.', 'Nobody on the team has real logical reasoning ability.', 'A useless teammate not only fails to help but puts all the blame on me.'] },
        { q: 'If saving the world required you to strip away all your emotions, including love, joy and sadness, would you do it?', options: ['Why me? If the world is going to end, let it end with all of us.', 'Perfect. Emotions only slow down my sword and pollute my thinking.', 'Emotions are just dopamine and hormones. Losing them does not affect the universe.', 'Pretend to agree, then look for a system bug that lets me keep a little emotion.'] },
        { q: 'How do you see “rules”?', options: ['Rules exist to be broken by the strong.', 'Rules are a placebo created by the weak to protect themselves.', 'Rules are part of the world’s operating algorithm. They can be exploited and rebuilt.', 'Rules are my cover. It is safest to cause trouble inside them.'] },
        { q: 'Which epitaph do you prefer?', options: ['“He came, he smashed this place, he was free.”', '“He finally got the absolute silence he had longed for.”', '“He solved this problem. Now he has gone to solve the next one.”', '“Even Death was fooled. He is somewhere else eating cheese.”'] },
        { q: 'You meet a supervillain you cannot defeat no matter what. What do you do?', options: ['Bite down like a mad dog. Even if I self-destruct, I will take half his life with me.', 'Tell him the world is a void illusion and collapse his logic.', 'Analyze his weakness, the terrain and the laws of physics, then build a guaranteed kill.', 'Surrender and become his second-in-command, then wait for a chance to stab him in the back.'] },
        { q: 'What is the most beautiful music in the world to you?', options: ['The roar of chains breaking and walls collapsing.', 'The absolutely quiet hiss of particles colliding in deep space.', 'The scratch of a pen deriving a perfect formula on scratch paper.', 'The furious cursing of a hunter when the trap snaps shut and finds nothing inside.'] },
        { q: '(Final interrogation) If you could make one request to the system right now, what would it be?', options: ['Give me enough firepower.', 'Give me supreme wisdom.', 'Give me an omniscient, omnipotent God’s-eye view.', 'Give me one chance to start over.'] }
      ]
    },
    es: {
      ui: {
        kicker: 'QUINTA DIMENSIÓN',
        title: 'Eco abisal',
        sub: 'Los datos extremos han activado una observación oculta. Completa 10 preguntas y el sistema decidirá si toma forma.',
        progress: 'Pregunta {n} / 10',
        scores: 'Ecos de rasgos',
        fifth: 'Quinta dimensión · Eco abisal'
      },
      types: {
        freedom: { name: 'Freedom GUNDAM', subtitle: 'Libertad · Rebelión · Poder absoluto', desc: 'Te niegas a que te definan o disciplinen. Si una regla se interpone, la rompes junto con la regla.' },
        madman: { name: 'El Loco', subtitle: 'Curiosidad infinita · Humanidad despojada · Verdad pura', desc: 'No te importa si el coste es razonable. Solo te importa si la respuesta existe.' },
        einstein: { name: 'Einstein', subtitle: 'Creatividad radical · Razonamiento · Visión divina', desc: 'Sales del sistema, ves su estructura y reescribes las reglas.' },
        jerry: { name: 'Jerry', subtitle: 'Resistencia · Astucia · Sabiduría de supervivencia', desc: 'No pueden matarte, pueden engañarte, y siempre sobrevives por las grietas.' }
      },
      questions: [
        { q: 'Si un día despiertas y descubres que el mundo es una simulación creada con un código pésimo, ¿cuál es tu primera reacción?', options: ['Encontrar la puerta trasera, echar al administrador y poner yo las reglas.', 'Abrir el código fuente. Quiero ver quién escribió esta montaña de basura.', 'No importa. Solo quiero saber si la constante gravitatoria se puede cambiar.', 'Hacerme pasar por un NPC y ver qué idiota me descubre.'] },
        { q: 'Ante un problema centenario, tedioso y que podría llevarte toda la vida, ¿qué haces?', options: ['Voltear la mesa. Si no puedo resolverlo, lo hago explotar con la mesa incluida.', 'Lanzarme sin dudar. Aunque acabe loco, quiero morir en manos de la verdad.', 'Cambiar de dimensión. La lógica de base puede estar mal desde el principio.', 'Dejarlo aparte y dormir. Seguro que alguien está más impaciente que yo.'] },
        { q: 'Si tuvieras el poder de viajar por el tiempo a voluntad, ¿qué harías primero?', options: ['Meter a todos los dictadores y tiranos de cabeza en un inodoro.', 'Ir al futuro y espiar las respuestas de todos los misterios sin resolver.', 'Volver a un segundo antes del Big Bang y ver qué pasó de verdad.', 'Volver a ayer y repetir una discusión que hice mal.'] },
        { q: 'En el trabajo en equipo, ¿qué es lo más insoportable para ti?', options: ['Que alguien me dé órdenes y trate de controlar lo que hago.', 'Que un grupo discuta preguntas superficiales de sentido común.', 'Que nadie del equipo tenga capacidad real de razonamiento lógico.', 'Que un compañero inútil no ayude y además me eche toda la culpa.'] },
        { q: 'Si salvar el mundo exigiera quitarte todas las emociones, incluidos el amor, la alegría y la tristeza, ¿lo harías?', options: ['¿Por qué yo? Si el mundo va a acabar, que acabe con todos nosotros.', 'Perfecto. Las emociones solo frenan mi espada y ensucian mi pensamiento.', 'Las emociones son dopamina y hormonas. Perderlas no afecta al universo.', 'Fingir que acepto y buscar un bug del sistema para conservar algo de emoción.'] },
        { q: '¿Cómo ves las “reglas”?', options: ['Las reglas existen para que los fuertes las rompan.', 'Las reglas son un placebo que los débiles crean para protegerse.', 'Las reglas son parte del algoritmo del mundo. Se pueden usar y reconstruir.', 'Las reglas son mi cobertura. Es más seguro causar problemas dentro de ellas.'] },
        { q: '¿Qué epitafio prefieres?', options: ['«Vino, destrozó este lugar, fue libre».', '«Por fin obtuvo el silencio absoluto que tanto deseaba».', '«Resolvió este problema. Ahora ha ido a resolver el siguiente».', '«Incluso engañó a la Muerte. Ahora está en otro lugar comiendo queso».'] },
        { q: 'Te enfrentas a un supervillano al que no puedes vencer de ninguna manera. ¿Qué haces?', options: ['Morderle como un perro rabioso. Aunque me inmole, le arrancaré media vida.', 'Decirle que el mundo es una ilusión vacía y hacer que su lógica colapse.', 'Analizar su debilidad, el terreno y las leyes físicas, y montar una trampa mortal.', 'Rendirme, ser su segundo al mando y esperar la oportunidad de apuñalarlo por la espalda.'] },
        { q: 'Para ti, ¿cuál es la música más hermosa del mundo?', options: ['El estruendo de cadenas rotas y muros que se derrumban.', 'El siseo absolutamente silencioso de partículas que chocan en el espacio profundo.', 'El raspar de una pluma al deducir una fórmula perfecta en un borrador.', 'Los insultos furiosos del cazador cuando la trampa se cierra y está vacía.'] },
        { q: '(Interrogatorio final) Si ahora pudieras pedirle una cosa al sistema, ¿qué pedirías?', options: ['Dame suficiente potencia de fuego.', 'Dame sabiduría suprema.', 'Dame una visión omnisciente y omnipotente.', 'Dame otra oportunidad de empezar de nuevo.'] }
      ]
    },
    pt: {
      ui: {
        kicker: 'QUINTA DIMENSÃO',
        title: 'Eco abissal',
        sub: 'Dados extremos ativaram uma observação oculta. Complete 10 perguntas e o sistema decidirá se ela toma forma.',
        progress: 'Pergunta {n} / 10',
        scores: 'Ecos de traços',
        fifth: 'Quinta dimensão · Eco abissal'
      },
      types: {
        freedom: { name: 'Freedom GUNDAM', subtitle: 'Liberdade · Rebelião · Poder absoluto', desc: 'Você se recusa a ser definido ou disciplinado. Se uma regra atrapalha, você a quebra junto com a regra.' },
        madman: { name: 'O Louco', subtitle: 'Curiosidade infinita · Humanidade despida · Verdade pura', desc: 'Você não se importa se o custo é razoável. Só se importa se a resposta existe.' },
        einstein: { name: 'Einstein', subtitle: 'Criatividade radical · Raciocínio · Visão divina', desc: 'Você sai do sistema, enxerga sua estrutura e reescreve as regras.' },
        jerry: { name: 'Jerry', subtitle: 'Resiliência · Astúcia · Sabedoria de sobrevivência', desc: 'Não conseguem te matar, conseguem te enganar, e você sempre sobrevive pelas frestas.' }
      },
      questions: [
        { q: 'Se um dia você acordasse e descobrisse que o mundo é uma simulação feita com um código péssimo, qual seria sua primeira reação?', options: ['Achar a porta dos fundos, expulsar o administrador e criar as regras eu mesmo.', 'Abrir o código-fonte. Quero ver quem escreveu essa pilha de lixo.', 'Não importa. Só quero saber se a constante gravitacional pode ser alterada.', 'Fingir que sou um NPC e ver qual idiota me descobre.'] },
        { q: 'Diante de um problema secular, chato e que pode consumir a sua vida inteira, o que você faz?', options: ['Virar a mesa. Se não consigo resolver, explodo o problema junto com a mesa.', 'Mergulhar sem hesitar. Mesmo que enlouqueça, quero morrer nas mãos da verdade.', 'Mudar de dimensão. A lógica de base pode estar errada desde o início.', 'Deixar de lado e dormir. Alguém vai estar mais impaciente que eu.'] },
        { q: 'Se você pudesse viajar no tempo à vontade, o que mais gostaria de fazer?', options: ['Meter todos os ditadores e tiranos de cabeça em um vaso sanitário.', 'Ir ao futuro e espiar as respostas de todos os mistérios não resolvidos.', 'Voltar a um segundo antes do Big Bang e ver o que realmente aconteceu.', 'Voltar a ontem e refazer uma discussão que conduzi mal.'] },
        { q: 'No trabalho em equipe, o que é mais insuportável para você?', options: ['Alguém mandar no meu comportamento e tentar me controlar.', 'Um grupo de pessoas discutindo questões superficiais de senso comum.', 'Ninguém da equipe ter capacidade real de raciocínio lógico.', 'Um colega inútil não ajudar e ainda jogar toda a culpa em mim.'] },
        { q: 'Se salvar o mundo exigisse retirar todas as suas emoções, incluindo amor, alegria e tristeza, você faria?', options: ['Por que eu? Se o mundo vai acabar, que acabe com todos nós.', 'Perfeito. Emoções só atrasam minha espada e sujam meu pensamento.', 'Emoções são só dopamina e hormônios. Perdê-las não afeta o universo.', 'Fingir que aceito e procurar um bug do sistema para manter um pouco de emoção.'] },
        { q: 'Como você vê as “regras”?', options: ['Regras existem para serem quebradas pelos fortes.', 'Regras são um placebo que os fracos criam para se proteger.', 'Regras fazem parte do algoritmo do mundo. Podem ser usadas e reconstruídas.', 'Regras são minha cobertura. É mais seguro causar problemas dentro delas.'] },
        { q: 'Qual epitáfio você prefere?', options: ['“Ele veio, destruiu este lugar, foi livre.”', '“Ele finalmente conseguiu o silêncio absoluto que tanto desejava.”', '“Ele resolveu este problema. Agora foi resolver o próximo.”', '“Até a Morte foi enganada. Ele está em outro lugar comendo queijo.”'] },
        { q: 'Você enfrenta um supervilão que não consegue vencer de jeito nenhum. O que faz?', options: ['Morder como um cão raivoso. Mesmo me explodindo, levo metade da vida dele.', 'Dizer que o mundo é uma ilusão vazia e fazer a lógica dele colapsar.', 'Analisar o ponto fraco, o terreno e as leis da física, e montar uma armadilha mortal.', 'Me render, virar o braço direito dele e esperar a chance de apunhalá-lo pelas costas.'] },
        { q: 'Para você, qual é a música mais bonita do mundo?', options: ['O estrondo de correntes quebradas e muros que desabam.', 'O sibilo absolutamente silencioso de partículas colidindo no espaço profundo.', 'O raspar da caneta ao deduzir uma fórmula perfeita no rascunho.', 'Os insultos furiosos do caçador quando a armadilha fecha e está vazia.'] },
        { q: '(Interrogatório final) Se agora pudesse fazer um pedido ao sistema, qual seria?', options: ['Me dê poder de fogo suficiente.', 'Me dê sabedoria suprema.', 'Me dê uma visão onisciente e onipotente.', 'Me dê uma chance de recomeçar.'] }
      ]
    },
    ko: {
      ui: {
        kicker: '다섯 번째 차원',
        title: '심연의 메아리',
        sub: '극단적인 데이터가 숨겨진 관측을 촉발했습니다. 10개의 질문을 마치면 시스템이 형체를 드러낼지 판단합니다.',
        progress: '질문 {n} / 10',
        scores: '특질의 메아리',
        fifth: '다섯 번째 차원 · 심연의 메아리'
      },
      types: {
        freedom: { name: '프리덤 건담', subtitle: '자유주의 · 반항 · 절대적인 힘', desc: '당신은 정의되거나 규율되기를 거부합니다. 규칙이 길을 막으면 규칙째 부숴 버립니다.' },
        madman: { name: '미치광이', subtitle: '무한한 탐구 · 인간성의 제거 · 순수한 진리', desc: '대가가 합리적인지는 상관없습니다. 오직 답이 존재하는지만 중요합니다.' },
        einstein: { name: '아인슈타인', subtitle: '극한의 창조 · 추론 · 신의 시점', desc: '시스템 밖에 서서 구조를 꿰뚫고 규칙을 다시 씁니다.' },
        jerry: { name: '제리', subtitle: '끈기 · 교활함 · 생존의 지혜', desc: '죽일 수 없고, 속일 수 있어도, 언제나 틈새로 살아남습니다.' }
      },
      questions: [
        { q: '어느 날 깨어나 세상이 형편없는 코드로 만든 가상 프로그램임을 알게 된다면, 첫 반응은?', options: ['백도어를 찾아 관리자를 쫓아내고 내가 규칙을 정한다.', '소스 코드를 뜯어본다. 이 쓰레기 같은 코드를 누가 썼는지 보고 싶다.', '그건 중요하지 않다. 중력 상수를 바꿀 수 있는지만 알고 싶다.', 'NPC인 척해서 어느 바보가 나를 발견하는지 본다.'] },
        { q: '평생을 바쳐야 풀 수 있는 지독하게 번거로운 세기적 난제를 만난다면?', options: ['책상을 뒤엎는다. 못 풀겠으면 문제와 책상을 같이 폭파한다.', '망설임 없이 뛰어든다. 미쳐도 진리에게 죽고 싶다.', '차원을 바꿔 생각한다. 근본 논리부터 틀렸을 수 있다.', '일단 옆에 두고 잔다. 누군가는 나보다 더 조급할 테니까.'] },
        { q: '시간을 마음대로 넘나드는 초능력이 생긴다면 가장 하고 싶은 것은?', options: ['모든 독재자와 폭군을 변기에 처박는다.', '미래로 가서 모든 미해결 수수께끼의 답을 훔쳐본다.', '과거로 가서 빅뱅 1초 전에 무슨 일이 있었는지 본다.', '어제로 돌아가서 망친 말다툼을 다시 한다.'] },
        { q: '팀워크에서 가장 참을 수 없는 것은?', options: ['누군가 내 행동에 참견하고 통제하려 든다.', '얕은 상식 문제를 두고 한 무리의 사람들이 떠든다.', '팀 전체에 진짜 논리적 추론 능력을 가진 사람이 없다.', '쓸모없는 팀원이 도움은 못 되고 책임만 내게 뒤집어쓴다.'] },
        { q: '세상을 구하려면 사랑, 기쁨, 슬픔을 포함한 모든 감정을 없애야 한다면 하겠는가?', options: ['왜 나지? 세상이 망할 거라면 다 같이 망하자.', '좋다. 감정은 검을 휘두르는 속도와 사고의 순수함만 방해한다.', '감정은 도파민과 호르몬의 분비물일 뿐이다. 버려도 우주는 돌아간다.', '일단 동의하는 척하고, 감정을 조금 남길 시스템 버그를 찾아본다.'] },
        { q: '“규칙”이라는 것을 어떻게 보는가?', options: ['규칙은 강자가 부수기 위해 있는 것이다.', '규칙은 약자가 자신을 보호하려 만든 위약이다.', '규칙은 세계의 알고리즘 일부다. 이용하고 재구성할 수 있다.', '규칙은 내 엄폐물이다. 규칙 안에서 몰래 일을 꾸미는 게 가장 안전하다.'] },
        { q: '다음 중 어떤 묘비명이 더 좋은가?', options: ['“그는 왔다, 이곳을 부쉈고, 자유로워졌다.”', '“그는 마침내 오래 갈망하던 절대적인 고요를 얻었다.”', '“그는 이 문제를 풀었다. 이제 다음 문제를 풀러 갔다.”', '“죽음마저 속였다. 그는 다른 곳에서 치즈를 먹고 있다.”'] },
        { q: '어떻게 해도 이길 수 없는 슈퍼 악당을 만난다면?', options: ['미친 개처럼 물고 늘어진다. 자폭해서라도 그의 목숨 절반을 가져간다.', '세상은 허무한 환영이라고 말해 그의 논리를 붕괴시킨다.', '약점, 지형, 물리 법칙을 분석해 반드시 죽일 함정을 만든다.', '항복하고 그의 부하가 된 뒤, 뒤통수를 칠 기회를 노린다.'] },
        { q: '당신에게 세상에서 가장 아름다운 음악은?', options: ['사슬이 부서지고 높은 벽이 무너지는 굉음.', '우주 심연에서 입자들이 충돌하며 내는 절대적으로 조용한 쉭쉭 소리.', '연습장에 펜으로 완벽한 공식을 유도할 때 나는 사각거림.', '쥐덫이 닫혔지만 안이 비어 있을 때 사냥꾼이 욕하는 소리.'] },
        { q: '(최종 심문) 지금 시스템에 한 가지 요구를 할 수 있다면?', options: ['충분한 화력을 달라.', '최고의 지혜를 달라.', '전지전능한 신의 시점을 달라.', '다시 시작할 기회를 달라.'] }
      ]
    },
    ja: {
      ui: {
        kicker: '第五次元',
        title: '深淵の反響',
        sub: '極端なデータが隠された観測を起動しました。10問を終えると、システムが顕現するか判断します。',
        progress: '第 {n} / 10 問',
        scores: '特質の反響',
        fifth: '第五次元 · 深淵の反響'
      },
      types: {
        freedom: { name: 'フリーダムガンダム', subtitle: '自由主義 · 反逆 · 絶対的な力', desc: 'あなたは定義されることも規律に従うことも拒む。規則が道を塞ぐなら、規則ごと壊す。' },
        madman: { name: '狂人', subtitle: '無限の求知 · 人間性の剥離 · 純粋な真理', desc: '代償が妥当かは気にしない。答えが存在するかだけを気にする。' },
        einstein: { name: 'アインシュタイン', subtitle: '極限の創造 · 推論 · 神の視点', desc: 'システムの外に立ち、構造を見抜き、ルールを書き換える。' },
        jerry: { name: 'ジェリー', subtitle: '回復力 · 狡猾さ · 生存の知恵', desc: '殺されず、騙され、それでもいつも隙間から生き延びる。' }
      },
      questions: [
        { q: 'ある朝目覚め、世界がひどく粗末なコードでできた仮想プログラムだと気づいたら、最初の反応は？', options: ['裏口を見つけ、管理者を追い出し、俺がルールを決める。', 'ソースコードをこじ開ける。このクソコードを誰が書いたのか見てやる。', 'どうでもいい。重力定数を変えられるかだけ知りたい。', 'NPCのふりをして、どの愚か者が俺を見つけるか試す。'] },
        { q: '一生を費やすほど面倒で、解くのに何世紀もかかりそうな難題に直面したら？', options: ['机をひっくり返す。解けないなら、問題ごと机ごと爆破する。', '迷わず飛び込む。最後に狂っても、真理の手で死にたい。', '次元を変えて考える。根本の論理が最初から間違っているかもしれない。', 'とりあえず置いて寝る。どうせ誰かが俺より先に焦っている。'] },
        { q: '自由に時空を移動できる超能力を得たら、一番したいことは？', options: ['すべての独裁者と暴君を便器に押し込む。', '未来へ行き、すべての未解決の謎の答えを盗み見る。', '過去へ行き、ビッグバン一秒前に何が起きたか見る。', '昨日へ戻り、うまく話せなかった口論をやり直す。'] },
        { q: 'チーム作業で最も耐えられないことは？', options: ['誰かが俺の行動にあれこれ口を出し、支配しようとする。', '浅い常識問題を、烏合の衆が延々と議論している。', 'チームの誰にも本物の論理的推論能力がない。', '役立たずの仲間が助けないうえ、責任を全部俺に押し付ける。'] },
        { q: '世界を救うために、愛・喜び・悲しみを含むすべての感情を奪う必要がある。あなたは応じる？', options: ['なぜ俺なんだ？世界が滅ぶなら、みんな一緒に滅ぼそう。', '最高だ。感情は剣を振る速度と思考の純粋さを邪魔するだけだ。', '感情はドーパミンとホルモンの分泌物だ。捨てても宇宙は回る。', 'いったん承諾したふりをして、感情を少し残すシステムバグを探す。'] },
        { q: '「ルール」をどう見ている？', options: ['ルールは強者が打ち砕くためにある。', 'ルールは弱者が自己防衛のために作ったプラシーボだ。', 'ルールは世界のアルゴリズムの一部だ。利用も再構築もできる。', 'ルールは俺の掩体だ。ルールの中でこっそり動くのが一番安全だ。'] },
        { q: '次のうち、どちらの墓誌銘が好き？', options: ['「彼は来た。ここを壊した。そして自由になった。」', '「彼はついに、長く渇望していた絶対の沈黙を得た。」', '「彼はこの問題を解いた。今は次の問題を解きに行った。」', '「死神さえ騙した。彼は今、別の場所でチーズを食べている。」'] },
        { q: 'どうしても勝てないスーパーヴィランに出会ったら？', options: ['狂犬のように噛みついて離さない。自爆しても奴の命を半分持っていく。', '世界は虚無の幻影だと告げ、奴の論理を崩壊させる。', '弱点、地形、物理法則を分析し、必殺の罠を組む。', '降伏してナンバー2になり、背後から刺す機会を待つ。'] },
        { q: 'あなたにとって世界で最も美しい音楽は？', options: ['鎖が砕け、高い壁が崩れる轟音。', '宇宙の深淵で粒子が衝突する、絶対的に静かな嘶き。', '草稿にペンで完璧な数式を導くときの、筆先の擦れる音。', '鼠取りが閉じたのに中が空だったとき、狩人が怒鳴る声。'] },
        { q: '（最終尋問）今、システムに一つだけ要求できるなら？', options: ['十分な火力をくれ。', '最高の知恵をくれ。', '全知全能の神の視点をくれ。', 'もう一度やり直す機会をくれ。'] }
      ]
    },
    fr: {
      ui: {
        kicker: 'CINQUIÈME DIMENSION',
        title: 'Écho abyssal',
        sub: 'Des données extrêmes ont déclenché une observation cachée. Répondez à 10 questions et le système décidera si elle prend forme.',
        progress: 'Question {n} / 10',
        scores: 'Échos des traits',
        fifth: 'Cinquième dimension · Écho abyssal'
      },
      types: {
        freedom: { name: 'Freedom GUNDAM', subtitle: 'Liberté · Rébellion · Puissance absolue', desc: 'Vous refusez d’être défini ou discipliné. Si une règle vous barre la route, vous la brisez avec la règle.' },
        madman: { name: 'Le Fou', subtitle: 'Curiosité infinie · Humanité dépouillée · Vérité pure', desc: 'Le coût vous importe peu. Seule compte l’existence de la réponse.' },
        einstein: { name: 'Einstein', subtitle: 'Créativité radicale · Raisonnement · Vision divine', desc: 'Vous sortez du système, voyez sa structure et réécrivez les règles.' },
        jerry: { name: 'Jerry', subtitle: 'Résilience · Ruse · Sagesse de survie', desc: 'On ne peut pas vous tuer, on peut vous tromper, et vous survivez toujours par les fissures.' }
      },
      questions: [
        { q: 'Si vous vous réveilliez un jour et découvriez que le monde est une simulation faite avec un code lamentable, quelle serait votre première réaction ?', options: ['Trouver la porte dérobée, virer l’administrateur et fixer les règles moi-même.', 'Ouvrir le code source. Je veux voir qui a écrit cette montagne de déchets.', 'Peu importe. Je veux seulement savoir si la constante gravitationnelle peut être changée.', 'Me faire passer pour un PNJ et voir quel idiot me remarque.'] },
        { q: 'Face à un problème séculaire, terriblement fastidieux et qui pourrait vous prendre toute une vie, que faites-vous ?', options: ['Je renverse la table. Si je ne peux pas le résoudre, je le fais exploser avec la table.', 'Je plonge sans hésiter. Même si je deviens fou, je veux mourir entre les mains de la vérité.', 'Je change de dimension. La logique de base est peut-être fausse depuis le début.', 'Je le mets de côté et je dors. Quelqu’un sera plus impatient que moi.'] },
        { q: 'Si vous pouviez voyager dans le temps à volonté, que feriez-vous en premier ?', options: ['Enfoncer tous les dictateurs et tyrans la tête la première dans des toilettes.', 'Aller dans le futur et espionner les réponses de tous les mystères non résolus.', 'Revenir une seconde avant le Big Bang pour voir ce qui s’est vraiment passé.', 'Revenir à hier et refaire une dispute que j’ai mal gérée.'] },
        { q: 'En travail d’équipe, qu’est-ce qui est le plus insupportable pour vous ?', options: ['Quelqu’un me donne des ordres et tente de contrôler mes actions.', 'Une foule de gens qui discutent de questions de bon sens sans profondeur.', 'Personne dans l’équipe n’a une vraie capacité de raisonnement logique.', 'Un coéquipier inutile qui n’aide pas et me met toute la faute dessus.'] },
        { q: 'Si sauver le monde exigeait de vous retirer toutes vos émotions, y compris l’amour, la joie et la tristesse, accepteriez-vous ?', options: ['Pourquoi moi ? Si le monde doit finir, qu’il finisse avec nous tous.', 'Parfait. Les émotions ne font que ralentir mon épée et troubler ma pensée.', 'Les émotions ne sont que dopamine et hormones. Les perdre n’affecte pas l’univers.', 'Faire semblant d’accepter, puis chercher un bug du système pour garder un peu d’émotion.'] },
        { q: 'Comment voyez-vous les « règles » ?', options: ['Les règles existent pour être brisées par les forts.', 'Les règles sont un placebo que les faibles créent pour se protéger.', 'Les règles font partie de l’algorithme du monde. On peut les exploiter et les reconstruire.', 'Les règles sont ma couverture. Il est plus sûr de comploter à l’intérieur.'] },
        { q: 'Quelle épitaphe préférez-vous ?', options: ['« Il est venu, il a tout cassé ici, il était libre. »', '« Il a enfin obtenu le silence absolu qu’il désirait tant. »', '« Il a résolu ce problème. Il est maintenant parti résoudre le suivant. »', '« Même la Mort a été trompée. Il mange du fromage ailleurs. »'] },
        { q: 'Vous affrontez un super-vilain que vous ne pouvez absolument pas battre. Que faites-vous ?', options: ['Je mords comme un chien enragé. Même en m’explosant, je lui prends la moitié de sa vie.', 'Je lui dis que le monde est une illusion vide et je fais effondrer sa logique.', 'J’analyse sa faiblesse, le terrain et les lois physiques, puis je prépare un piège mortel.', 'Je me rends, je deviens son bras droit et j’attends une occasion de le poignarder dans le dos.'] },
        { q: 'Pour vous, quelle est la plus belle musique du monde ?', options: ['Le grondement des chaînes brisées et des murs qui s’effondrent.', 'Le sifflement absolument silencieux des particules qui entrent en collision dans l’espace profond.', 'Le grattement d’un stylo qui déduit une formule parfaite sur un brouillon.', 'Les jurons furieux du chasseur quand le piège se referme et qu’il est vide.'] },
        { q: '(Interrogatoire final) Si vous pouviez faire une seule demande au système maintenant, laquelle ?', options: ['Donne-moi assez de puissance de feu.', 'Donne-moi la sagesse suprême.', 'Donne-moi une vision omnisciente et omnipotente.', 'Donne-moi une chance de tout recommencer.'] }
      ]
    }
  };

  const TYPE_EXTRA = {
    'zh-CN': {
      freedom: { congrats: '恭喜。你触发了极低概率的第五维度：自由高达。', explain: '这不是普通的人格标签，而是一种极端倾向：你把自由看得高于秩序，把反抗视为本能，并相信真正的力量应该由自己定义。' },
      madman: { congrats: '恭喜。你触发了极稀有的第五维度：疯子。', explain: '你对知识的渴望超过了对安全、关系甚至人性的需求。你愿意为真相付出任何代价，也因此看见了别人不愿看见的深渊。' },
      einstein: { congrats: '恭喜。你触发了极低概率的第五维度：爱因斯坦。', explain: '你拥有把复杂世界压缩成结构的能力。你习惯跳出系统看问题，创造新的推理路径，而不是接受现成答案。' },
      jerry: { congrats: '恭喜。你触发了极低概率的第五维度：杰瑞鼠。', explain: '你的核心不是蛮力，而是生存智慧：韧性、狡猾、适应力和一点点坏运气都打不死你。你总能在规则缝隙里找到下一步。' }
    },
    'zh-TW': {
      freedom: { congrats: '恭喜。你觸發了極低機率的第五維度：自由鋼彈。', explain: '這不是普通的人格標籤，而是一種極端傾向：你把自由看得高於秩序，把反抗視為本能，並相信真正的力量應該由自己定義。' },
      madman: { congrats: '恭喜。你觸發了極稀有的第五維度：瘋子。', explain: '你對知識的渴望超過了對安全、關係甚至人性的需求。你願意為真相付出任何代價，也因此看見了別人不願看見的深淵。' },
      einstein: { congrats: '恭喜。你觸發了極低機率的第五維度：愛因斯坦。', explain: '你擁有把複雜世界壓縮成結構的能力。你習慣跳出系統看問題，創造新的推理路徑，而不是接受現成答案。' },
      jerry: { congrats: '恭喜。你觸發了極低機率的第五維度：傑瑞鼠。', explain: '你的核心不是蠻力，而是生存智慧：韌性、狡猾、適應力和一點點壞運氣都打不死你。你總能在規則縫隙裡找到下一步。' }
    },
    en: {
      freedom: { congrats: 'Congratulations. You have triggered an extremely rare fifth dimension: Freedom GUNDAM.', explain: 'This is not an ordinary personality label. It is an extreme tendency: you place freedom above order, treat rebellion as instinct, and believe true power should be defined by you.' },
      madman: { congrats: 'Congratulations. You have triggered an extremely rare fifth dimension: The Madman.', explain: 'Your hunger for knowledge exceeds your need for safety, relationships, even humanity. You will pay any price for the truth, and that is why you see abysses others refuse to look at.' },
      einstein: { congrats: 'Congratulations. You have triggered an extremely rare fifth dimension: Einstein.', explain: 'You can compress a complicated world into structure. You step outside the system, invent new paths of reasoning, and refuse to accept ready-made answers.' },
      jerry: { congrats: 'Congratulations. You have triggered an extremely rare fifth dimension: Jerry.', explain: 'Your core is not brute force but survival wisdom: resilience, cunning, adaptability and a little bad luck cannot kill you. You always find the next move in the cracks of the rules.' }
    },
    es: {
      freedom: { congrats: 'Felicidades. Has activado una quinta dimensión extremadamente rara: Freedom GUNDAM.', explain: 'No es una etiqueta de personalidad normal. Es una tendencia extrema: pones la libertad por encima del orden, tratas la rebelión como instinto y crees que el verdadero poder debe definirlo tú.' },
      madman: { congrats: 'Felicidades. Has activado una quinta dimensión extremadamente rara: El Loco.', explain: 'Tu hambre de conocimiento supera tu necesidad de seguridad, de relaciones e incluso de humanidad. Pagarías cualquier precio por la verdad, y por eso ves abismos que otros evitan mirar.' },
      einstein: { congrats: 'Felicidades. Has activado una quinta dimensión extremadamente rara: Einstein.', explain: 'Puedes comprimir un mundo complejo en estructura. Sales del sistema, inventas nuevas rutas de razonamiento y te niegas a aceptar respuestas ya hechas.' },
      jerry: { congrats: 'Felicidades. Has activado una quinta dimensión extremadamente rara: Jerry.', explain: 'Tu núcleo no es la fuerza bruta, sino la sabiduría de supervivencia: resistencia, astucia, adaptación y un poco de mala suerte no pueden matarte. Siempre encuentras el siguiente movimiento en las grietas de las reglas.' }
    },
    pt: {
      freedom: { congrats: 'Parabéns. Você ativou uma quinta dimensão extremamente rara: Freedom GUNDAM.', explain: 'Não é um rótulo de personalidade comum. É uma tendência extrema: você coloca a liberdade acima da ordem, trata a rebelião como instinto e acredita que o verdadeiro poder deve ser definido por você.' },
      madman: { congrats: 'Parabéns. Você ativou uma quinta dimensão extremamente rara: O Louco.', explain: 'Sua fome de conhecimento supera a necessidade de segurança, de relações e até de humanidade. Você pagaria qualquer preço pela verdade, e por isso vê abismos que os outros evitam olhar.' },
      einstein: { congrats: 'Parabéns. Você ativou uma quinta dimensão extremamente rara: Einstein.', explain: 'Você consegue comprimir um mundo complexo em estrutura. Sai do sistema, inventa novos caminhos de raciocínio e se recusa a aceitar respostas prontas.' },
      jerry: { congrats: 'Parabéns. Você ativou uma quinta dimensão extremamente rara: Jerry.', explain: 'Seu núcleo não é a força bruta, mas a sabedoria de sobrevivência: resiliência, astúcia, adaptação e um pouco de azar não conseguem te matar. Você sempre encontra o próximo movimento nas frestas das regras.' }
    },
    ko: {
      freedom: { congrats: '축하합니다. 당신은 극히 낮은 확률의 다섯 번째 차원을 열었습니다: 프리덤 건담.', explain: '이것은 평범한 성격 라벨이 아니라 극단적인 성향입니다. 당신은 자유를 질서보다 위에 두고, 반항을 본능으로 여기며, 진정한 힘은 자신이 정의해야 한다고 믿습니다.' },
      madman: { congrats: '축하합니다. 당신은 극히 희귀한 다섯 번째 차원을 열었습니다: 미치광이.', explain: '지식에 대한 갈망이 안전, 관계, 심지어 인간성에 대한 필요보다 큽니다. 진리를 위해 어떤 대가도 치를 수 있기에, 다른 사람이 보지 않으려는 심연을 봅니다.' },
      einstein: { congrats: '축하합니다. 당신은 극히 낮은 확률의 다섯 번째 차원을 열었습니다: 아인슈타인.', explain: '복잡한 세계를 구조로 압축할 수 있습니다. 시스템 밖으로 나와 새로운 추론 경로를 만들고, 주어진 답을 그대로 받아들이지 않습니다.' },
      jerry: { congrats: '축하합니다. 당신은 극히 낮은 확률의 다섯 번째 차원을 열었습니다: 제리.', explain: '당신의 핵심은 완력이 아니라 생존의 지혜입니다. 끈기, 교활함, 적응력, 그리고 약간의 불운도 당신을 죽일 수 없습니다. 언제나 규칙의 틈에서 다음 수를 찾습니다.' }
    },
    ja: {
      freedom: { congrats: 'おめでとう。あなたは極めて低い確率の第五次元を起動しました：フリーダムガンダム。', explain: 'これは普通の性格ラベルではありません。自由を秩序より上に置き、反逆を本能とし、真の力は自分で定義すべきだと信じる極端な傾向です。' },
      madman: { congrats: 'おめでとう。あなたは極めて希少な第五次元を起動しました：狂人。', explain: '知識への渇望が、安全、関係、さらには人間性への必要を超えています。真理のためにどんな代償も払うからこそ、他人が見ようとしない深淵を見るのです。' },
      einstein: { congrats: 'おめでとう。あなたは極めて低い確率の第五次元を起動しました：アインシュタイン。', explain: '複雑な世界を構造に圧縮できます。システムの外に出て新しい推論の道を作り、用意された答えを受け入れません。' },
      jerry: { congrats: 'おめでとう。あなたは極めて低い確率の第五次元を起動しました：ジェリー。', explain: '核となるのは腕力ではなく生存の知恵です。粘り強さ、狡猾さ、適応力、そして少しの不運でもあなたは死にません。いつもルールの隙間に次の一手を見つけます。' }
    },
    fr: {
      freedom: { congrats: 'Félicitations. Vous avez déclenché une cinquième dimension extrêmement rare : Freedom GUNDAM.', explain: 'Ce n’est pas une étiquette de personnalité ordinaire. C’est une tendance extrême : vous placez la liberté au-dessus de l’ordre, faites de la rébellion un instinct et croyez que la vraie puissance doit être définie par vous.' },
      madman: { congrats: 'Félicitations. Vous avez déclenché une cinquième dimension extrêmement rare : Le Fou.', explain: 'Votre soif de connaissance dépasse votre besoin de sécurité, de relations et même d’humanité. Vous paierez n’importe quel prix pour la vérité, et c’est pourquoi vous voyez des abîmes que les autres refusent de regarder.' },
      einstein: { congrats: 'Félicitations. Vous avez déclenché une cinquième dimension extrêmement rare : Einstein.', explain: 'Vous pouvez comprimer un monde complexe en structure. Vous sortez du système, inventez de nouveaux chemins de raisonnement et refusez les réponses toutes faites.' },
      jerry: { congrats: 'Félicitations. Vous avez déclenché une cinquième dimension extrêmement rare : Jerry.', explain: 'Votre force n’est pas la violence, mais la sagesse de survie : résilience, ruse, adaptation et un peu de malchance ne peuvent pas vous tuer. Vous trouvez toujours le prochain coup dans les fissures des règles.' }
    }
  };
  Object.keys(TYPE_EXTRA).forEach(lang => {
    if(!PACKS[lang]) return;
    Object.keys(TYPE_EXTRA[lang]).forEach(k => Object.assign(PACKS[lang].types[k], TYPE_EXTRA[lang][k]));
  });

  function get(lang){ return PACKS[lang] || PACKS['zh-CN']; }

  function checkUnlock(res){
    const d = (res && res.dominanceScore) || {};
    const n = id => Number(d[id]) || 0;
    const out = [];
    if(n('D') > 85 && n('H') > 85) out.push('freedom');
    if(n('U') > 85 && n('M') > 85 && n('E') > 85) out.push('madman');
    if(n('C') > 85 && n('D') > 80 && n('U') > 80) out.push('einstein');
    if(n('R') > 85 && n('T') > 80 && n('A') > 80) out.push('jerry');
    return out;
  }

  function evaluate(answers, unlocked){
    if(!Array.isArray(answers) || answers.length < 10) return null;
    const unlockedKeys = Array.isArray(unlocked) ? unlocked : [];
    const scores = { freedom: 0, madman: 0, einstein: 0, jerry: 0 };
    answers.slice(0, 10).forEach(v => {
      const k = TRAITS[Number(v)];
      if(k) scores[k] += 1;
    });
    const sorted = TRAITS.slice().sort((a, b) => scores[b] - scores[a]);
    const top = sorted[0], second = sorted[1];
    if(scores[top] < 7) return null;
    if(scores[top] - scores[second] < 3) return null;
    if(unlockedKeys.indexOf(top) < 0) return null;
    return { key: top, obtained: true, scores: scores, answers: answers.slice(0, 10) };
  }

  window.QBTI_HIDDEN = {
    TRAITS: TRAITS,
    get: get,
    checkUnlock: checkUnlock,
    evaluate: evaluate
  };
})();
