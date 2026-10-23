(function(){
  'use strict';
  const PACKS = {
    'zh-CN': {
      kicker: 'FIRST OBSERVATION',
      stepLabel: '第 {n} / {total} 步',
      hint: '点击屏幕任意位置以继续',
      finalHint: '选择是否保留这份引导',
      disable: '不再提醒',
      done: '开始探索',
      steps: [
        { title: '从这里进入 QBTi', body: '点击顶部 QBTi，开始 40 题观测。完成后会得到你的量子学习类型。' },
        { title: '按住大量子球', body: '回到主页，按住中央的大量子球，保持一会儿，它会炸开成四颗小量子球。' },
        { title: '按住小量子球，然后松手', body: '四颗小球出现后，按住任意一颗，松手进入它的维度。' },
        { title: '炸开之后，有两个选择', body: '你可以查看这个维度的量子态状况，也可以直接进入量子球，生成一段引导剧本。' },
        { title: '历史观测记录', body: '进入 QBTi 首页后向下滚动，可以看到每一次观测结果；登录后还会跨设备同步。' },
        { title: '联系我们与反馈', body: '顶部的联系我们里，可以提交投诉、建议，或查看联系邮箱。' },
        { title: '设置在这里', body: '右下角设置可以调整语言、字号、亮度、量子球配色，也可以重新播放这份引导。' }
      ],
      final: { title: '准备开始观测', body: '你可以随时在设置里重新播放这份引导。现在，去打开你的第一颗量子球吧。' }
    },
    'zh-TW': {
      kicker: 'FIRST OBSERVATION',
      stepLabel: '第 {n} / {total} 步',
      hint: '點擊螢幕任意位置以繼續',
      finalHint: '選擇是否保留這份引導',
      disable: '不再提醒',
      done: '開始探索',
      steps: [
        { title: '從這裡進入 QBTi', body: '點擊頂部 QBTi，開始 40 題觀測。完成後會得到你的量子學習類型。' },
        { title: '按住大量子球', body: '回到主頁，按住中央的大量子球，保持一會兒，它會炸開成四顆小量子球。' },
        { title: '按住小量子球，然後鬆手', body: '四顆小球出現後，按住任意一顆，鬆手進入它的維度。' },
        { title: '炸開之後，有兩個選擇', body: '你可以查看這個維度的量子態狀況，也可以直接進入量子球，生成一段引導劇本。' },
        { title: '歷史觀測記錄', body: '進入 QBTi 首頁後向下捲動，可以看到每一次觀測結果；登入後還會跨裝置同步。' },
        { title: '聯絡我們與回饋', body: '頂部的聯絡我們裡，可以提交投訴、建議，或查看聯絡信箱。' },
        { title: '設定在這裡', body: '右下角設定可以調整語言、字號、亮度、量子球配色，也可以重新播放這份引導。' }
      ],
      final: { title: '準備開始觀測', body: '你可以隨時在設定裡重新播放這份引導。現在，去打開你的第一顆量子球吧。' }
    },
    en: {
      kicker: 'FIRST OBSERVATION',
      stepLabel: 'Step {n} / {total}',
      hint: 'Click anywhere to continue',
      finalHint: 'Choose whether to keep this guide',
      disable: 'Don’t remind me again',
      done: 'Start exploring',
      steps: [
        { title: 'Enter QBTi here', body: 'Click QBTi at the top to start the 40-question observation. You will receive your quantum learning type at the end.' },
        { title: 'Hold the large quantum ball', body: 'On the home screen, press and hold the central quantum ball. Keep holding until it bursts into four smaller balls.' },
        { title: 'Hold a small ball, then release', body: 'Once the four balls appear, press and hold any one of them, then release to enter its dimension.' },
        { title: 'Two choices after the burst', body: 'You can view this dimension’s quantum state, or enter the ball directly to generate a guided script.' },
        { title: 'Observation history', body: 'Scroll down on the QBTi home screen to see every observation result. When logged in, history syncs across devices.' },
        { title: 'Contact and feedback', body: 'Open Contact at the top to submit a complaint or suggestion, or find the contact email.' },
        { title: 'Settings are here', body: 'The settings button at the bottom right changes language, font size, brightness and sphere colors, and can replay this guide.' }
      ],
      final: { title: 'Ready to observe', body: 'You can replay this guide from Settings whenever you want. Now go and open your first quantum ball.' }
    },
    es: {
      kicker: 'PRIMERA OBSERVACIÓN',
      stepLabel: 'Paso {n} / {total}',
      hint: 'Haz clic en cualquier lugar para continuar',
      finalHint: 'Elige si quieres conservar esta guía',
      disable: 'No volver a recordar',
      done: 'Empezar a explorar',
      steps: [
        { title: 'Entra en QBTi aquí', body: 'Pulsa QBTi arriba para empezar las 40 preguntas. Al terminar recibirás tu tipo de aprendizaje cuántico.' },
        { title: 'Mantén la bola cuántica grande', body: 'En la pantalla de inicio, mantén pulsada la bola central hasta que estalle en cuatro bolas pequeñas.' },
        { title: 'Mantén una bola pequeña y suelta', body: 'Cuando aparezcan las cuatro bolas, mantén pulsada cualquiera y suéltala para entrar en su dimensión.' },
        { title: 'Dos opciones después del estallido', body: 'Puedes ver el estado cuántico de esta dimensión o entrar en la bola para generar un guion guiado.' },
        { title: 'Historial de observaciones', body: 'Desplázate hacia abajo en la página de QBTi para ver cada resultado. Al iniciar sesión, el historial se sincroniza entre dispositivos.' },
        { title: 'Contacto y comentarios', body: 'Abre Contacto arriba para enviar una queja o sugerencia, o consultar el correo de contacto.' },
        { title: 'Los ajustes están aquí', body: 'El botón de ajustes abajo a la derecha cambia idioma, tamaño de letra, brillo y colores de la esfera, y permite repetir esta guía.' }
      ],
      final: { title: 'Listo para observar', body: 'Puedes repetir esta guía desde Ajustes cuando quieras. Ahora abre tu primera bola cuántica.' }
    },
    pt: {
      kicker: 'PRIMEIRA OBSERVAÇÃO',
      stepLabel: 'Passo {n} / {total}',
      hint: 'Clique em qualquer lugar para continuar',
      finalHint: 'Escolha se quer manter este guia',
      disable: 'Não lembrar novamente',
      done: 'Começar a explorar',
      steps: [
        { title: 'Entre no QBTi aqui', body: 'Clique em QBTi no topo para começar as 40 perguntas. No final você recebe seu tipo de aprendizagem quântica.' },
        { title: 'Segure a bola quântica grande', body: 'Na tela inicial, mantenha pressionada a bola central até ela explodir em quatro bolas menores.' },
        { title: 'Segure uma bola pequena e solte', body: 'Quando as quatro bolas aparecerem, mantenha qualquer uma pressionada e solte para entrar na dimensão dela.' },
        { title: 'Duas escolhas após a explosão', body: 'Você pode ver o estado quântico desta dimensão ou entrar na bola para gerar um roteiro guiado.' },
        { title: 'Histórico de observações', body: 'Role a página inicial do QBTi para ver cada resultado. Ao entrar na conta, o histórico sincroniza entre dispositivos.' },
        { title: 'Contato e feedback', body: 'Abra Contato no topo para enviar uma reclamação ou sugestão, ou consultar o email de contato.' },
        { title: 'As configurações ficam aqui', body: 'O botão de configurações no canto inferior direito muda idioma, fonte, brilho e cores da esfera, e permite repetir este guia.' }
      ],
      final: { title: 'Pronto para observar', body: 'Você pode repetir este guia nas Configurações quando quiser. Agora abra sua primeira bola quântica.' }
    },
    ko: {
      kicker: '첫 관측',
      stepLabel: '{n} / {total} 단계',
      hint: '화면 아무 곳이나 클릭하여 계속',
      finalHint: '이 안내를 유지할지 선택하세요',
      disable: '다시 알리지 않기',
      done: '탐색 시작',
      steps: [
        { title: '여기서 QBTi 시작', body: '상단의 QBTi를 눌러 40문항 관측을 시작하세요. 마치면 양자 학습 유형을 받게 됩니다.' },
        { title: '큰 양자 구를 길게 누르기', body: '홈 화면에서 중앙의 큰 양자 구를 길게 누르세요. 잠시 유지하면 네 개의 작은 구로 터집니다.' },
        { title: '작은 구를 누른 뒤 손 떼기', body: '네 개의 구가 나타나면 아무 구나 길게 누른 뒤 손을 떼어 해당 차원으로 들어가세요.' },
        { title: '터진 뒤 두 가지 선택', body: '이 차원의 양자 상태를 보거나, 구 안으로 들어가 안내 스크립트를 생성할 수 있습니다.' },
        { title: '관측 기록', body: 'QBTi 홈 화면을 아래로 스크롤하면 모든 관측 결과를 볼 수 있습니다. 로그인하면 기기 간에 동기화됩니다.' },
        { title: '문의와 피드백', body: '상단의 문의에서 불만이나 제안을 보내거나 연락 이메일을 확인할 수 있습니다.' },
        { title: '설정은 여기', body: '오른쪽 아래 설정에서 언어, 글자 크기, 밝기, 양자 구 색을 바꾸고 이 안내를 다시 볼 수 있습니다.' }
      ],
      final: { title: '관측을 시작할 준비', body: '설정에서 언제든 이 안내를 다시 볼 수 있습니다. 이제 첫 번째 양자 구를 열어 보세요.' }
    },
    ja: {
      kicker: '最初の観測',
      stepLabel: 'ステップ {n} / {total}',
      hint: '画面の任意の場所をクリックして続行',
      finalHint: 'このガイドを残すか選択してください',
      disable: '今後表示しない',
      done: '探索を始める',
      steps: [
        { title: 'ここから QBTi へ', body: '上部の QBTi を押して40問の観測を始めます。終わると量子学習タイプが表示されます。' },
        { title: '大きな量子球を長押し', body: 'ホーム画面で中央の大きな量子球を長押ししてください。しばらくすると4つの小さな球に分かれます。' },
        { title: '小さな球を長押しして離す', body: '4つの球が出たら、好きな球を長押しして離すと、その次元に入ります。' },
        { title: '分かれた後の2つの選択', body: 'この次元の量子状態を見るか、球の中に入ってガイド付きスクリプトを生成できます。' },
        { title: '観測履歴', body: 'QBTi ホームを下にスクロールすると、これまでの観測結果が見られます。ログインすると端末間で同期されます。' },
        { title: 'お問い合わせとフィードバック', body: '上部のお問い合わせから、意見や提案を送ったり、連絡先メールを確認できます。' },
        { title: '設定はここ', body: '右下の設定で言語、文字サイズ、明るさ、量子球の色を変えたり、このガイドを再生できます。' }
      ],
      final: { title: '観測の準備ができました', body: '設定からいつでもこのガイドを再生できます。では、最初の量子球を開いてみましょう。' }
    },
    fr: {
      kicker: 'PREMIÈRE OBSERVATION',
      stepLabel: 'Étape {n} / {total}',
      hint: 'Cliquez n’importe où pour continuer',
      finalHint: 'Choisissez si vous gardez ce guide',
      disable: 'Ne plus me rappeler',
      done: 'Commencer l’exploration',
      steps: [
        { title: 'Entrez dans QBTi ici', body: 'Cliquez sur QBTi en haut pour commencer les 40 questions. À la fin, vous recevrez votre type d’apprentissage quantique.' },
        { title: 'Maintenez la grande sphère quantique', body: 'Sur l’accueil, maintenez la sphère centrale jusqu’à ce qu’elle éclate en quatre petites sphères.' },
        { title: 'Maintenez une petite sphère puis relâchez', body: 'Quand les quatre sphères apparaissent, maintenez-en une puis relâchez pour entrer dans sa dimension.' },
        { title: 'Deux choix après l’explosion', body: 'Vous pouvez voir l’état quantique de cette dimension ou entrer dans la sphère pour générer un scénario guidé.' },
        { title: 'Historique des observations', body: 'Faites défiler l’accueil de QBTi pour voir chaque résultat. Une fois connecté, l’historique se synchronise entre appareils.' },
        { title: 'Contact et retours', body: 'Ouvrez Contact en haut pour envoyer une réclamation ou une suggestion, ou consulter l’email de contact.' },
        { title: 'Les réglages sont ici', body: 'Le bouton de réglages en bas à droite change la langue, la taille du texte, la luminosité et les couleurs de la sphère, et permet de rejouer ce guide.' }
      ],
      final: { title: 'Prêt à observer', body: 'Vous pouvez rejouer ce guide depuis les Réglages quand vous voulez. Maintenant, ouvrez votre première sphère quantique.' }
    }
  };
  window.QBTI_ONBOARDING = {
    get(lang){ return PACKS[lang] || PACKS.en; }
  };
})();
