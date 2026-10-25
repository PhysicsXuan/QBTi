(function(){
  'use strict';
  const PACKS = {
    'zh-CN': {
      kicker: 'FIRST OBSERVATION', stepLabel: '第 {n} / {total} 步', hint: '点击屏幕任意位置以继续',
      hintTarget: '点击高亮位置以继续',
      hintHold: '按住高亮框里的量子球，完成操作后会自动继续', finalHint: '选择是否保留这份引导',
      disable: '不再提醒', done: '开始探索',
      steps: [
        { title: '从这里进入 QBTi', body: 'QBTi 是 Quantum Behavior Type Indicator。它用 40 道题，描述你还没被单一评价体系观测到的那部分。它不做诊断，也不给你下定义，只生成一份量子行为类型。' },
        { title: 'QBTi 是什么', body: '它用 4 个维度、81 种类型描述你现在的行为倾向。没有正确答案，也没有好坏，只记录你此刻的波函数。' },
        { title: '怎么做这 40 题', body: '点开始观测，按第一反应作答。每题 1–5 分，大约 8–12 分钟。中途可以返回，完成后会生成结果。' },
        { title: '怎么查看历史记录', body: '完成一次观测后，记录会出现在这里。点任意一条可以恢复结果；登录后会跨设备同步。' },
        { title: '现在回到主页', body: 'QBTi 的部分讲完了。点顶部主页，回到量子球，继续看它怎么用。' },
        { title: '按住大量子球', body: '在主页按住中央的大量子球，保持一会儿，它会炸开成四颗小量子球。' },
        { title: '按住这一颗小量子球，然后松手', body: '先只认识这一颗。按住高亮方框里的球，松手进入它的维度；另外三颗稍后再看。' },
        { title: '炸开后的两个选择', body: '你可以查看这个维度的量子态状况，也可以进入量子球生成剧本。想回到四颗球，随时点下面的返回键。' },
        { title: '想回去，点这个返回键', body: '返回键会关掉当前选择，把你带回四颗小量子球，不会丢失这次观测。' },
        { title: '联系我们与反馈', body: '顶部的联系我们里，可以提交投诉、建议，或查看联系邮箱。' },
        { title: '设置在这里', body: '右下角设置可以调整语言、字号、亮度、量子球配色，也可以重新播放这份引导。' }
      ],
      final: { title: '准备开始观测', body: '你可以随时在设置里重新播放这份引导。现在，去打开你的第一颗量子球吧。' }
    },
    'zh-TW': {
      kicker: 'FIRST OBSERVATION', stepLabel: '第 {n} / {total} 步', hint: '點擊螢幕任意位置以繼續',
      hintTarget: '點擊高亮位置以繼續',
      hintHold: '按住高亮框裡的量子球，完成操作後會自動繼續', finalHint: '選擇是否保留這份引導',
      disable: '不再提醒', done: '開始探索',
      steps: [
        { title: '從這裡進入 QBTi', body: 'QBTi 是 Quantum Behavior Type Indicator。它用 40 道題，描述你還沒被單一評價體系觀測到的那部分。它不做診斷，也不給你下定義，只生成一份量子行為類型。' },
        { title: 'QBTi 是什麼', body: '它用 4 個維度、81 種類型描述你現在的行為傾向。沒有正確答案，也沒有好壞，只記錄你此刻的波函數。' },
        { title: '怎麼做這 40 題', body: '點開始觀測，按第一反應作答。每題 1–5 分，大約 8–12 分鐘。中途可以返回，完成後會生成結果。' },
        { title: '怎麼查看歷史記錄', body: '完成一次觀測後，記錄會出現在這裡。點任意一則可以恢復結果；登入後會跨裝置同步。' },
        { title: '現在回到主頁', body: 'QBTi 的部分講完了。點頂部主頁，回到量子球，繼續看它怎麼用。' },
        { title: '按住大量子球', body: '在主頁按住中央的大量子球，保持一會兒，它會炸開成四顆小量子球。' },
        { title: '按住這一顆小量子球，然後鬆手', body: '先只認識這一顆。按住高亮方框裡的球，鬆手進入它的維度；另外三顆稍後再看。' },
        { title: '炸開後的兩個選擇', body: '你可以查看這個維度的量子態狀況，也可以進入量子球生成劇本。想回到四顆球，隨時點下面的返回鍵。' },
        { title: '想回去，點這個返回鍵', body: '返回鍵會關掉目前選擇，把你帶回四顆小量子球，不會遺失這次觀測。' },
        { title: '聯絡我們與回饋', body: '頂部的聯絡我們裡，可以提交投訴、建議，或查看聯絡信箱。' },
        { title: '設定在這裡', body: '右下角設定可以調整語言、字號、亮度、量子球配色，也可以重新播放這份引導。' }
      ],
      final: { title: '準備開始觀測', body: '你可以隨時在設定裡重新播放這份引導。現在，去打開你的第一顆量子球吧。' }
    },
    en: {
      kicker: 'FIRST OBSERVATION', stepLabel: 'Step {n} / {total}', hint: 'Click anywhere to continue',
      hintTarget: 'Click the highlighted control to continue',
      hintHold: 'Press and hold the quantum ball inside the highlighted box; it advances automatically', finalHint: 'Choose whether to keep this guide',
      disable: 'Don’t remind me again', done: 'Start exploring',
      steps: [
        { title: 'Enter QBTi here', body: 'QBTi stands for Quantum Behavior Type Indicator. Its 40 questions describe the part of you that single rankings and grades rarely observe. It does not diagnose or define you; it produces a quantum behavior type.' },
        { title: 'What QBTi is', body: 'It uses four dimensions and 81 types to describe your current behavioral tendency. There are no right answers and no good or bad results; it records the wavefunction you are in right now.' },
        { title: 'How to do the 40 questions', body: 'Press Start and answer from your first reaction. Each question is scored 1–5 and takes about 8–12 minutes. You can go back; a result appears at the end.' },
        { title: 'How to view history', body: 'After one observation, the record appears here. Tap any card to restore that result; when logged in, history syncs across devices.' },
        { title: 'Now return home', body: 'That is the QBTi part. Tap Home at the top to return to the quantum balls and continue.' },
        { title: 'Hold the large quantum ball', body: 'On the home screen, press and hold the central quantum ball until it bursts into four smaller balls.' },
        { title: 'Hold this small ball, then release', body: 'Let’s finish one ball first. Press and hold the ball inside the highlighted square, then release to enter its dimension. The other three come later.' },
        { title: 'Two choices after the burst', body: 'You can view this dimension’s quantum state or enter the ball to generate a script. To return to the four balls, use the back button below at any time.' },
        { title: 'To go back, use this button', body: 'The back button closes the current choice and returns you to the four small balls. Your observation is not lost.' },
        { title: 'Contact and feedback', body: 'Open Contact at the top to submit a complaint or suggestion, or find the contact email.' },
        { title: 'Settings are here', body: 'The settings button at the bottom right changes language, font size, brightness and sphere colors, and can replay this guide.' }
      ],
      final: { title: 'Ready to observe', body: 'You can replay this guide from Settings whenever you want. Now go and open your first quantum ball.' }
    },
    es: {
      kicker: 'PRIMERA OBSERVACIÓN', stepLabel: 'Paso {n} / {total}', hint: 'Haz clic en cualquier lugar para continuar',
      hintTarget: 'Toca el control resaltado para continuar',
      hintHold: 'Mantén pulsada la bola cuántica dentro del recuadro; avanzará automáticamente', finalHint: 'Elige si quieres conservar esta guía',
      disable: 'No volver a recordar', done: 'Empezar a explorar',
      steps: [
        { title: 'Entra en QBTi aquí', body: 'QBTi significa Quantum Behavior Type Indicator. Sus 40 preguntas describen la parte de ti que las notas y los rankings rara vez observan. No diagnostica ni te define; genera un tipo de comportamiento cuántico.' },
        { title: 'Qué es QBTi', body: 'Usa cuatro dimensiones y 81 tipos para describir tu tendencia actual. No hay respuestas correctas ni resultados buenos o malos; registra la función de onda en la que estás ahora.' },
        { title: 'Cómo hacer las 40 preguntas', body: 'Pulsa Empezar y responde con tu primera reacción. Cada pregunta va de 1 a 5 y tarda unos 8–12 minutos. Puedes volver atrás; al final aparece un resultado.' },
        { title: 'Cómo ver el historial', body: 'Después de una observación, el registro aparece aquí. Toca una tarjeta para recuperar el resultado; al iniciar sesión, el historial se sincroniza entre dispositivos.' },
        { title: 'Ahora vuelve al inicio', body: 'Esa es la parte de QBTi. Pulsa Inicio arriba para volver a las bolas cuánticas y seguir.' },
        { title: 'Mantén la bola cuántica grande', body: 'En el inicio, mantén pulsada la bola central hasta que estalle en cuatro bolas pequeñas.' },
        { title: 'Mantén esta bola pequeña y suelta', body: 'Terminemos una bola primero. Mantén pulsada la bola del recuadro y suéltala para entrar en su dimensión. Las otras tres vienen después.' },
        { title: 'Dos opciones tras el estallido', body: 'Puedes ver el estado cuántico de esta dimensión o entrar en la bola para generar un guion. Para volver a las cuatro bolas, usa el botón de abajo.' },
        { title: 'Para volver, usa este botón', body: 'El botón de volver cierra la elección actual y te devuelve a las cuatro bolas pequeñas. No pierdes la observación.' },
        { title: 'Contacto y comentarios', body: 'Abre Contacto arriba para enviar una queja o sugerencia, o consultar el correo.' },
        { title: 'Los ajustes están aquí', body: 'El botón de ajustes abajo a la derecha cambia idioma, letra, brillo y colores, y permite repetir esta guía.' }
      ],
      final: { title: 'Listo para observar', body: 'Puedes repetir esta guía desde Ajustes cuando quieras. Ahora abre tu primera bola cuántica.' }
    },
    pt: {
      kicker: 'PRIMEIRA OBSERVAÇÃO', stepLabel: 'Passo {n} / {total}', hint: 'Clique em qualquer lugar para continuar',
      hintTarget: 'Toque no controle destacado para continuar',
      hintHold: 'Mantenha pressionada a bola quântica dentro da caixa; avança automaticamente', finalHint: 'Escolha se quer manter este guia',
      disable: 'Não lembrar novamente', done: 'Começar a explorar',
      steps: [
        { title: 'Entre no QBTi aqui', body: 'QBTi significa Quantum Behavior Type Indicator. As 40 perguntas descrevem a parte de você que notas e rankings raramente observam. Não diagnostica nem define você; gera um tipo de comportamento quântico.' },
        { title: 'O que é o QBTi', body: 'Usa quatro dimensões e 81 tipos para descrever sua tendência atual. Não há respostas certas nem resultados bons ou ruins; registra a função de onda em que você está agora.' },
        { title: 'Como fazer as 40 perguntas', body: 'Clique em Começar e responda pela primeira reação. Cada pergunta vale 1–5 e leva cerca de 8–12 minutos. Você pode voltar; no final aparece um resultado.' },
        { title: 'Como ver o histórico', body: 'Depois de uma observação, o registro aparece aqui. Toque em um cartão para recuperar o resultado; ao entrar na conta, o histórico sincroniza entre dispositivos.' },
        { title: 'Agora volte ao início', body: 'Essa é a parte do QBTi. Clique em Início no topo para voltar às bolas quânticas e continuar.' },
        { title: 'Segure a bola quântica grande', body: 'No início, mantenha pressionada a bola central até ela explodir em quatro bolas menores.' },
        { title: 'Segure esta bola pequena e solte', body: 'Vamos terminar uma bola primeiro. Mantenha a bola dentro da caixa pressionada e solte para entrar na dimensão dela. As outras três vêm depois.' },
        { title: 'Duas escolhas após a explosão', body: 'Você pode ver o estado quântico desta dimensão ou entrar na bola para gerar um roteiro. Para voltar às quatro bolas, use o botão abaixo.' },
        { title: 'Para voltar, use este botão', body: 'O botão volta fecha a escolha atual e retorna às quatro bolas pequenas. Sua observação não é perdida.' },
        { title: 'Contato e feedback', body: 'Abra Contato no topo para enviar uma reclamação ou sugestão, ou consultar o email.' },
        { title: 'As configurações ficam aqui', body: 'O botão de configurações no canto inferior direito muda idioma, fonte, brilho e cores, e permite repetir este guia.' }
      ],
      final: { title: 'Pronto para observar', body: 'Você pode repetir este guia nas Configurações quando quiser. Agora abra sua primeira bola quântica.' }
    },
    ko: {
      kicker: '첫 관측', stepLabel: '{n} / {total} 단계', hint: '화면 아무 곳이나 클릭하여 계속',
      hintTarget: '강조된 항목을 눌러 계속',
      hintHold: '강조 상자 안의 양자 구를 길게 누르면 자동으로 진행됩니다', finalHint: '이 안내를 유지할지 선택하세요',
      disable: '다시 알리지 않기', done: '탐색 시작',
      steps: [
        { title: '여기서 QBTi 시작', body: 'QBTi는 Quantum Behavior Type Indicator입니다. 40개의 질문이 성적과 순위가 잘 관측하지 못하는 당신의 일부를 설명합니다. 진단하거나 정의하지 않고 양자 행동 유형을 만듭니다.' },
        { title: 'QBTi란 무엇인가', body: '4개 차원과 81개 유형으로 현재의 행동 경향을 설명합니다. 정답도 좋고 나쁨도 없으며, 지금의 파동함수를 기록할 뿐입니다.' },
        { title: '40문항 하는 방법', body: '시작을 누르고 첫 반응으로 답하세요. 각 문항은 1–5점이며 약 8–12분 걸립니다. 중간에 돌아갈 수 있고, 마치면 결과가 나옵니다.' },
        { title: '관측 기록 보는 방법', body: '한 번 관측하면 기록이 여기에 나타납니다. 카드를 누르면 결과를 복원하고, 로그인하면 기기 간에 동기화됩니다.' },
        { title: '이제 홈으로 돌아가기', body: 'QBTi 부분은 끝났습니다. 상단의 홈을 눌러 양자 구로 돌아가 계속하세요.' },
        { title: '큰 양자 구를 길게 누르기', body: '홈에서 중앙의 큰 양자 구를 길게 누르면 네 개의 작은 구로 터집니다.' },
        { title: '이 작은 구를 누른 뒤 손 떼기', body: '먼저 하나만 알아봅시다. 강조 상자 안의 구를 길게 누른 뒤 손을 떼어 해당 차원으로 들어가세요. 나머지 셋은 나중에.' },
        { title: '터진 뒤 두 가지 선택', body: '이 차원의 양자 상태를 보거나 구 안으로 들어가 스크립트를 만들 수 있습니다. 네 개의 구로 돌아가려면 아래의 뒤로 버튼을 누르세요.' },
        { title: '돌아가려면 이 버튼', body: '뒤로 버튼은 현재 선택을 닫고 네 개의 작은 구로 돌아갑니다. 이번 관측은 사라지지 않습니다.' },
        { title: '문의와 피드백', body: '상단의 문의에서 불만이나 제안을 보내거나 연락 이메일을 확인할 수 있습니다.' },
        { title: '설정은 여기', body: '오른쪽 아래 설정에서 언어, 글자 크기, 밝기, 구 색을 바꾸고 이 안내를 다시 볼 수 있습니다.' }
      ],
      final: { title: '관측을 시작할 준비', body: '설정에서 언제든 이 안내를 다시 볼 수 있습니다. 이제 첫 번째 양자 구를 열어 보세요.' }
    },
    ja: {
      kicker: '最初の観測', stepLabel: 'ステップ {n} / {total}', hint: '画面の任意の場所をクリックして続行',
      hintTarget: 'ハイライトされた場所を押して続行',
      hintHold: 'ハイライトされた枠内の量子球を長押しすると自動で進みます', finalHint: 'このガイドを残すか選択してください',
      disable: '今後表示しない', done: '探索を始める',
      steps: [
        { title: 'ここから QBTi へ', body: 'QBTi は Quantum Behavior Type Indicator。40問が、成績や順位では観測されにくいあなたの部分を描きます。診断や定義ではなく、量子行動タイプを生成します。' },
        { title: 'QBTi とは', body: '4つの次元と81タイプで、今の行動傾向を説明します。正解も良し悪しもなく、今の波動関数を記録するだけです。' },
        { title: '40問のやり方', body: '開始を押し、直感で答えます。各問1–5点、約8–12分。途中で戻れます。終わると結果が出ます。' },
        { title: '観測履歴の見方', body: '一度観測すると、ここに記録が出ます。カードを押すと結果を復元でき、ログインすると端末間で同期されます。' },
        { title: 'ホームに戻る', body: 'QBTi の説明はここまで。上部のホームを押して量子球に戻りましょう。' },
        { title: '大きな量子球を長押し', body: 'ホームで中央の大きな量子球を長押しすると、4つの小さな球に分かれます。' },
        { title: 'この小さな球を長押しして離す', body: 'まず1つだけ。ハイライト枠の中の球を長押しして離すと、その次元に入ります。残り3つは後で。' },
        { title: '分かれた後の2つの選択', body: 'この次元の量子状態を見るか、球に入ってスクリプトを生成できます。4つの球に戻るには下の戻るボタン。' },
        { title: '戻るときはこのボタン', body: '戻るボタンは今の選択を閉じ、4つの小さな球に戻します。観測は失われません。' },
        { title: 'お問い合わせとフィードバック', body: '上部のお問い合わせから意見や提案を送ったり、連絡先メールを確認できます。' },
        { title: '設定はここ', body: '右下の設定で言語、文字サイズ、明るさ、球の色を変えたり、このガイドを再生できます。' }
      ],
      final: { title: '観測の準備ができました', body: '設定からいつでもこのガイドを再生できます。では、最初の量子球を開いてみましょう。' }
    },
    fr: {
      kicker: 'PREMIÈRE OBSERVATION', stepLabel: 'Étape {n} / {total}', hint: 'Cliquez n’importe où pour continuer',
      hintTarget: 'Touchez l’élément surligné pour continuer',
      hintHold: 'Maintenez la sphère quantique dans le cadre ; cela avance automatiquement', finalHint: 'Choisissez si vous gardez ce guide',
      disable: 'Ne plus me rappeler', done: 'Commencer l’exploration',
      steps: [
        { title: 'Entrez dans QBTi ici', body: 'QBTi signifie Quantum Behavior Type Indicator. Ses 40 questions décrivent la partie de vous que les notes et classements observent rarement. Il ne diagnostique pas et ne vous définit pas ; il génère un type de comportement quantique.' },
        { title: 'Qu’est-ce que QBTi', body: 'Il utilise quatre dimensions et 81 types pour décrire votre tendance actuelle. Il n’y a ni bonne réponse ni bon ou mauvais résultat ; il enregistre la fonction d’onde dans laquelle vous êtes.' },
        { title: 'Comment faire les 40 questions', body: 'Appuyez sur Commencer et répondez à la première réaction. Chaque question vaut 1–5 et prend environ 8–12 minutes. Vous pouvez revenir ; un résultat apparaît à la fin.' },
        { title: 'Comment voir l’historique', body: 'Après une observation, l’enregistrement apparaît ici. Touchez une carte pour restaurer le résultat ; connecté, l’historique se synchronise entre appareils.' },
        { title: 'Revenez à l’accueil', body: 'La partie QBTi est terminée. Appuyez sur Accueil en haut pour revenir aux sphères quantiques.' },
        { title: 'Maintenez la grande sphère', body: 'Sur l’accueil, maintenez la sphère centrale jusqu’à ce qu’elle éclate en quatre petites sphères.' },
        { title: 'Maintenez cette petite sphère puis relâchez', body: 'Finissons une sphère d’abord. Maintenez la sphère dans le cadre puis relâchez pour entrer dans sa dimension. Les trois autres viendront après.' },
        { title: 'Deux choix après l’explosion', body: 'Vous pouvez voir l’état quantique de cette dimension ou entrer dans la sphère pour générer un scénario. Pour revenir aux quatre sphères, utilisez le bouton ci-dessous.' },
        { title: 'Pour revenir, utilisez ce bouton', body: 'Le bouton retour ferme le choix actuel et vous ramène aux quatre petites sphères. Votre observation n’est pas perdue.' },
        { title: 'Contact et retours', body: 'Ouvrez Contact en haut pour envoyer une réclamation ou une suggestion, ou consulter l’email.' },
        { title: 'Les réglages sont ici', body: 'Le bouton de réglages en bas à droite change langue, taille du texte, luminosité et couleurs, et permet de rejouer ce guide.' }
      ],
      final: { title: 'Prêt à observer', body: 'Vous pouvez rejouer ce guide depuis les Réglages quand vous voulez. Maintenant, ouvrez votre première sphère quantique.' }
    }
  };
  const EXTRA = {
    'zh-CN': {
      script: { title: '剧本是什么', body: '进入量子球后，{assistant} 会以这个维度为背景生成一段互动剧本。它不是测试，没有标准答案；每次会出现几个选择，你的选择会改变后续走向。' },
      settings: [
        { title: '设置在这里', body: '点开右下角设置，我们一项一项看。' },
        { title: '语言', body: '这里切换界面和问卷语言，选择后立即生效。' },
        { title: '亮度', body: '拖动滑块调整整体亮度。' },
        { title: '量子球效果', body: '简洁或常规；也可以在上方调整量子球配色。' },
        { title: '重新查看新手教程', body: '最后，这里可以重新播放新手引导。' }
      ]
    },
    'zh-TW': {
      script: { title: '劇本是什麼', body: '進入量子球後，{assistant} 會以這個維度為背景生成一段互動劇本。它不是測驗，沒有標準答案；每次會出現幾個選擇，你的選擇會改變後續走向。' },
      settings: [
        { title: '設定在這裡', body: '點開右下角設定，我們一項一項看。' },
        { title: '語言', body: '這裡切換介面和問卷語言，選擇後立即生效。' },
        { title: '亮度', body: '拖動滑桿調整整體亮度。' },
        { title: '量子球效果', body: '簡潔或常規；也可以在上方調整量子球配色。' },
        { title: '重新查看新手教學', body: '最後，這裡可以重新播放新手引導。' }
      ]
    },
    en: {
      script: { title: 'What the script is', body: 'After you enter the quantum ball, {assistant} generates an interactive script set in this dimension. It is not a test and has no standard answer; every turn offers a few choices, and your choices change what happens next.' },
      settings: [
        { title: 'Settings are here', body: 'Open Settings at the bottom right and we will go through it one item at a time.' },
        { title: 'Language', body: 'Change the interface and questionnaire language here. It applies immediately.' },
        { title: 'Brightness', body: 'Drag this slider to adjust the overall brightness.' },
        { title: 'Quantum ball effects', body: 'Choose Simple or Normal; you can also change the quantum ball colors above.' },
        { title: 'Replay the new-user guide', body: 'Finally, this button replays the onboarding guide.' }
      ]
    },
    es: {
      script: { title: 'Qué es el guion', body: 'Al entrar en la bola cuántica, {assistant} genera un guion interactivo ambientado en esta dimensión. No es un examen y no tiene respuesta estándar; cada turno ofrece varias opciones y tus elecciones cambian lo que ocurre.' },
      settings: [
        { title: 'Los ajustes están aquí', body: 'Abre los ajustes abajo a la derecha y los veremos uno por uno.' },
        { title: 'Idioma', body: 'Cambia aquí el idioma de la interfaz y del cuestionario. Se aplica al instante.' },
        { title: 'Brillo', body: 'Arrastra este control para ajustar el brillo general.' },
        { title: 'Efectos de la bola cuántica', body: 'Elige Simple o Normal; también puedes cambiar los colores arriba.' },
        { title: 'Repetir la guía', body: 'Por último, este botón vuelve a reproducir la guía para nuevos usuarios.' }
      ]
    },
    pt: {
      script: { title: 'O que é o roteiro', body: 'Ao entrar na bola quântica, {assistant} gera um roteiro interativo ambientado nesta dimensão. Não é uma prova e não tem resposta padrão; a cada turno aparecem algumas escolhas, e suas escolhas mudam o que acontece.' },
      settings: [
        { title: 'As configurações ficam aqui', body: 'Abra as configurações no canto inferior direito e veremos uma por uma.' },
        { title: 'Idioma', body: 'Altere aqui o idioma da interface e do questionário. Aplica na hora.' },
        { title: 'Brilho', body: 'Arraste este controle para ajustar o brilho geral.' },
        { title: 'Efeitos da bola quântica', body: 'Escolha Simples ou Normal; também pode mudar as cores acima.' },
        { title: 'Repetir o guia', body: 'Por último, este botão reproduz novamente o guia para novos usuários.' }
      ]
    },
    ko: {
      script: { title: '스크립트란', body: '양자 구에 들어가면 {assistant}가 이 차원을 배경으로 인터랙티브 스크립트를 생성합니다. 시험이 아니고 정답도 없으며, 매 장면 몇 가지 선택지가 나오고 당신의 선택이 이후 전개를 바꿉니다.' },
      settings: [
        { title: '설정은 여기', body: '오른쪽 아래 설정을 열고 하나씩 살펴봅시다.' },
        { title: '언어', body: '여기서 인터페이스와 설문 언어를 바꿉니다. 즉시 적용됩니다.' },
        { title: '밝기', body: '슬라이더를 움직여 전체 밝기를 조정하세요.' },
        { title: '양자 구 효과', body: '간단 또는 보통을 고르세요. 위에서 양자 구 색도 바꿀 수 있습니다.' },
        { title: '초보자 안내 다시 보기', body: '마지막으로 이 버튼은 초보자 안내를 다시 재생합니다.' }
      ]
    },
    ja: {
      script: { title: '脚本とは', body: '量子球に入ると、{assistant}がこの次元を舞台にインタラクティブな脚本を生成します。テストではなく正解もありません。場面ごとにいくつかの選択肢が出て、選んだ内容で後の展開が変わります。' },
      settings: [
        { title: '設定はここ', body: '右下の設定を開いて、一つずつ見ていきましょう。' },
        { title: '言語', body: 'ここで画面と質問の言語を変えられます。すぐに反映されます。' },
        { title: '明るさ', body: 'スライダーを動かして全体の明るさを調整します。' },
        { title: '量子球の効果', body: 'シンプルか通常を選べます。上で量子球の配色も変えられます。' },
        { title: '初心者ガイドを再表示', body: '最後に、このボタンで初心者ガイドをもう一度再生できます。' }
      ]
    },
    fr: {
      script: { title: 'Qu’est-ce que le scénario', body: 'En entrant dans la sphère quantique, {assistant} génère un scénario interactif dans cette dimension. Ce n’est pas un test et il n’y a pas de bonne réponse ; chaque scène propose quelques choix, et vos choix changent la suite.' },
      settings: [
        { title: 'Les réglages sont ici', body: 'Ouvrez les réglages en bas à droite et nous allons les voir un par un.' },
        { title: 'Langue', body: 'Changez ici la langue de l’interface et du questionnaire. Cela s’applique immédiatement.' },
        { title: 'Luminosité', body: 'Faites glisser ce curseur pour ajuster la luminosité générale.' },
        { title: 'Effets de la sphère quantique', body: 'Choisissez Simple ou Normal ; vous pouvez aussi changer les couleurs au-dessus.' },
        { title: 'Revoir le guide', body: 'Enfin, ce bouton relance le guide du nouvel utilisateur.' }
      ]
    }
  };
  Object.keys(PACKS).forEach(function(lang){
    const p = PACKS[lang], e = EXTRA[lang];
    if(!p || !e) return;
    p.steps = p.steps.slice(0, 8).concat([e.script], p.steps.slice(8, 10), e.settings);
  });
  const AUTH = {
    'zh-CN': { title: '先登录或创建账户', body: '登录后，你的 QBTi 结果、历史记录和设置才会保存到自己的账户。完成登录后，我们继续。', login: '已有账户，登录', register: '创建新账户', hint: '登录后才能继续新手引导' },
    'zh-TW': { title: '先登入或建立帳戶', body: '登入後，你的 QBTi 結果、歷史記錄和設定才會儲存到自己的帳戶。完成登入後，我們繼續。', login: '已有帳戶，登入', register: '建立新帳戶', hint: '登入後才能繼續新手引導' },
    en: { title: 'Sign in or create an account', body: 'Your QBTi results, history and settings are saved to your own account. Sign in to continue the guide.', login: 'I have an account', register: 'Create an account', hint: 'Sign in to continue the guide' },
    es: { title: 'Inicia sesión o crea una cuenta', body: 'Tus resultados QBTi, el historial y los ajustes se guardan en tu cuenta. Inicia sesión para continuar.', login: 'Ya tengo cuenta', register: 'Crear una cuenta', hint: 'Inicia sesión para continuar' },
    pt: { title: 'Entre ou crie uma conta', body: 'Seus resultados QBTi, histórico e configurações ficam salvos na sua conta. Entre para continuar.', login: 'Já tenho conta', register: 'Criar uma conta', hint: 'Entre para continuar o guia' },
    ko: { title: '로그인하거나 계정 만들기', body: 'QBTi 결과, 기록, 설정은 내 계정에 저장됩니다. 로그인하면 안내를 계속합니다.', login: '이미 계정이 있어요', register: '새 계정 만들기', hint: '로그인해야 안내를 계속할 수 있습니다' },
    ja: { title: 'ログインまたはアカウント作成', body: 'QBTi の結果・履歴・設定は自分のアカウントに保存されます。ログインするとガイドを続けられます。', login: 'アカウントを持っている', register: '新しいアカウントを作成', hint: 'ログインするとガイドを続けられます' },
    fr: { title: 'Connectez-vous ou créez un compte', body: 'Vos résultats QBTi, votre historique et vos réglages sont enregistrés dans votre compte. Connectez-vous pour continuer.', login: 'J’ai déjà un compte', register: 'Créer un compte', hint: 'Connectez-vous pour continuer le guide' }
  };
  Object.keys(PACKS).forEach(function(lang){
    if(PACKS[lang] && AUTH[lang]) PACKS[lang].auth = AUTH[lang];
  });
  window.QBTI_ONBOARDING = { get(lang){ return PACKS[lang] || PACKS.en; } };
})();
