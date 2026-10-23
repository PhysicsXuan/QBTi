(function(){
  'use strict';
  const ZH = {
    choice: {
      kicker: 'NEBULA OPEN',
      title: '量子球已经炸开',
      sub: '接下来，你想先读取它现在的量子态，还是直接进入球内？',
      statusLabel: '查看量子态状况',
      statusDesc: '先看它现在处在哪个能级',
      enterLabel: '进入量子球',
      enterDesc: '生成一段这个维度的引导剧本'
    },
    ui: {
      kicker: 'QUANTUM STATE OBSERVATION',
      title: '量子态观测',
      loading: '正在读取量子场…',
      loadingLines: ['正在读取这个维度的相干性、能级与引导倾向…', '观测不会消耗你的对话次数。'],
      stability: { high: '高相干', medium: '中等相干', low: '低相干' },
      log: { title: '点击展开：当前维度的物理观测日志', loading: '观测站正在读取这一维度的能级、势垒和行为…', error: '观测站信号暂时中断', retry: '重新连接', tags: ['能级观测', '势垒描述', '量子行为', '跃迁引导'] },
      continue: '点击屏幕任意位置以继续',
      finish: '点击任意位置完成观测',
      close: '结束观测',
      tabs: '维度'
    },
    states: {
      good: { name: '低能稳定态', visual: '低能稳定 · 相干锁定' },
      superposition: { name: '叠加态', visual: '叠加 · 相位未锁定' },
      danger: { name: '高能不稳定态', visual: '高能 · 退相干' }
    },
    energyLead: '你刚刚炸开的是 {dim} 这一颗量子球。',
    barrierLead: '势垒不是敌人，它只是你现在真实遇到的阻力。',
    ladderLead: '量子能量不是连续爬坡，而是一阶一阶跳。',
    behaviorLead: '这个维度正在用一种独特的方式维持自己。',
    leapLead: '跃迁不是被推着走，而是一次可选的、轻轻的位移。',
    fourLead: '你不是四种人格中的一种，而是四个维度同时处在不同的能级。',
    currentLevel: '当前能级 n={level}，稳定度：{stability}。',
    sections: {
      energy: '能级观测',
      barrier: '势垒描述',
      ladder: '量子能量阶梯',
      behavior: '量子行为',
      leap: '跃迁引导',
      four: '四维量子场'
    },
    energyState: {
      PO: { good: '低能稳定态', superposition: '门缝叠加态', danger: '高能散射态' },
      II: { good: '持续激发态', superposition: '双频跃迁态', danger: '能量泄漏态' },
      LA: { good: '超导态', superposition: '路径叠加态', danger: '轨道退相干态' },
      UR: { good: '相干基态', superposition: '隧穿叠加态', danger: '高能耗散态' }
    },
    energyNote: '这不是好坏评价，只是你现在所在的能量位置。',
    barrier: {
      PO: '势垒不是“你不够勇敢”。它是门外没有足够已知信号时，身体自然产生的迟疑；先允许这堵墙存在，门才有被重新看见的可能。',
      II: '势垒不是懒。它是意义感、热情和外部要求没有同频时产生的内耗；推力越大，噪声越响。',
      LA: '势垒来自“被安排”与“自己想走”的拉扯。你还没有拿到足够的自主空间，所以轨道总被外部指令改写。',
      UR: '势垒是恢复速度暂时跟不上挑战幅度。不确定本身在消耗能量，先恢复，不等于退缩。'
    },
    barrierState: {
      good: '这堵墙不高，但它真实存在；你不需要假装它不存在。',
      superposition: '墙在两种可能之间移动；你既想过去，又不想失去退路。',
      danger: '墙现在偏高，硬撞会继续漏能；先允许它存在，是降低损耗的一部分。'
    },
    barrierNote: '势垒不需要现在被克服。先允许它存在，能量才不会被“必须马上解决”继续抽走。',
    behavior: {
      PO: '你用的是“弱测量”：不直接推开门，而是先听门缝、看灰尘、试探风的方向。你通过不把结果看死，保留更多可能。',
      II: '你用的是“脉冲激发”：靠一阵一阵的热情点火，而不是持续燃烧。间歇不是失败，是当前能量供给方式。',
      LA: '你用的是“模式切换”：在自主和外部指令之间来回切换，用不同模式保住前进。',
      UR: '你用的是“量子隧穿”：不把高墙撞碎，而是从最薄的地方穿过去；幽默、撤退、硬撑，都是你的隧穿路径。'
    },
    behaviorType: {
      good: '这个策略目前是有效的，它让你的能量没有白白耗散。',
      superposition: '这个策略让你同时保留两条路，但也让你难以完全锁定一条。',
      danger: '这个策略在帮你活下来，同时也在消耗你；它值得被看见，而不是被责怪。'
    },
    behaviorNote: '这是你在当前能量状态下长出来的生存策略，不是缺陷。',
    leap: {
      PO: '如果愿意，下一次不必推开门。只把耳朵贴近门缝，听一秒，再决定要不要继续。',
      II: '如果愿意，先不急着重新点火。只问自己一句：还有什么值得我再加一次燃料？',
      LA: '如果愿意，先不规划整条路。只画出下一步的一个点，然后允许自己只走到那里。',
      UR: '如果愿意，先不解决不确定。只允许自己在雾里站一会儿，看看哪一块地面是稳的。'
    },
    leapState: {
      good: '不需要一次跳很远，你已经在一条可维持的轨道上。',
      superposition: '不需要现在选死一边，先让下一次观测更清楚。',
      danger: '不需要马上跃迁，先让能量停止继续漏，就是下一步。'
    },
    leapNote: '这不是建议，也不是要求。只是一个开放的邀请：你可以现在跳，也可以先不跳。',
    pageKickers: ['ENERGY LEVEL', 'POTENTIAL BARRIER', 'ENERGY LADDER', 'QUANTUM BEHAVIOR', 'QUANTUM LEAP', 'FOUR-DIMENSIONAL FIELD'],
    pageTitles: ['{dim} · 能级观测', '势垒描述', '量子能量阶梯', '量子行为', '跃迁引导', '四维量子场'],
    stateBody: {
      PO: {
        good: '你的潜能量子球已经锁在一个相对低的能级上。它不再四处乱撞，而是把能量收束到少数几个真正想探索的方向。',
        superposition: '你的潜能量子球同时停在两个能级之间：一边是熟悉的控制台，一边是还没打开的门。它还没有被观测死，所以两种可能都还在。',
        danger: '你的潜能量子球处在高能不稳定态，能量不断从缝隙里漏掉。不是你没有潜能，而是观测方向太分散，球还没有找到稳定的轨道。'
      },
      II: {
        good: '你的内在驱动量子球处于低能稳定态，能量集中而持续。它不需要外部不断加火，也能维持自己的燃烧。',
        superposition: '你的内在驱动量子球在两个能级之间来回跃迁：有时被意义点亮，有时又退回待机。它需要一次足够明确的观测，才会塌缩到持续燃烧的能级。',
        danger: '你的内在驱动量子球能量外泄，热情和意义没有对上频率。不是你没有动力，而是驱动信号被噪声盖住了。'
      },
      LA: {
        good: '你的学习自主量子球已经形成稳定轨道，能量可以自己调度。你不需要每一步都被推动，也能维持方向。',
        superposition: '你的学习自主量子球处在叠加态：一部分想自己规划，一部分仍在等待外部指令。两种模式同时存在，观测方式会决定它往哪边塌缩。',
        danger: '你的学习自主量子球能量不稳定，轨道容易被外界打断。不是你不能自主，而是当前的能量还不足以维持一条自己的路线。'
      },
      UR: {
        good: '你的未知应变量子球处在低能稳定态，面对不确定时仍能保持相干。你能在雾里继续走，而不急着让所有答案立刻出现。',
        superposition: '你的未知应变量子球在两种反应之间叠加：想冲进去，也想先退一步。它还没有被一次足够安全的观测固定。',
        danger: '你的未知应变量子球处于高能不稳定态，遇到不确定时能量快速耗散。不是你不勇敢，而是当前的恢复力还没跟上挑战的幅度。'
      }
    },
    guidance: {
      title: '引导倾向',
      clear: { label: '已形成', body: '这个维度的量子球已经有明确指向。外界的引导更像调频：不需要重新发射信号，只需要把现有频率对准。' },
      forming: { label: '正在形成', body: '球已经有了偏向，但还没有完全锁定。一次足够好的观测，可能让它向更清晰的方向塌缩。' },
      weak: { label: '尚未形成', body: '球还在几个能级之间漂移。此时直接给答案，会打断它自己的观测；先让方向自己显影。' },
      blocked: { label: '暂时受阻', body: '能量在泄漏，信号被噪声盖住。先恢复稳定，比继续加推力更重要。' }
    },
    ladder: {
      title: '量子能量阶梯',
      levels: ['n=1 基态', 'n=2 激发', 'n=3 相干', 'n=4 高能', 'n=5 跃迁'],
      body: '你的{dim}量子球当前停在 n={level} 能级。量子能量不是连续爬坡，而是一次一次跃迁；下一阶是 n={next}。',
      foot: '能量按阶梯跳跃 · 每次观测只允许一个稳定落点'
    },
    quantum: {
      title: '量子语言翻译',
      good: '低能级 + 高相干 = 方向稳定，能量集中在少数轨道。',
      superposition: '叠加态 + 相位未锁定 = 多种可能同时存在，观测方式决定它往哪边塌缩。',
      danger: '高能级 + 退相干 = 能量泄漏，信号被噪声覆盖；先降噪，再谈跃迁。'
    },
    four: {
      title: '四维量子场',
      sub: '四个维度的球同时存在；点击任意一个，切换观测。'
    }
  };

  const EN = {
    choice: {
      kicker: 'NEBULA OPEN',
      title: 'The quantum ball has burst',
      sub: 'Do you want to read its current quantum state first, or step straight inside?',
      statusLabel: 'View quantum state',
      statusDesc: 'See which energy level it is on',
      enterLabel: 'Enter the quantum ball',
      enterDesc: 'Generate a guided script for this dimension'
    },
    ui: {
      kicker: 'QUANTUM STATE OBSERVATION',
      title: 'Quantum State Observation',
      loading: 'Reading the quantum field…',
      loadingLines: ['Reading this dimension’s coherence, energy level and guidance tendency…', 'This observation does not consume your dialogue quota.'],
      stability: { high: 'High coherence', medium: 'Moderate coherence', low: 'Low coherence' },
      log: { title: 'Click to open: physical observation log for this dimension', loading: 'The station is reading this dimension’s energy level, barrier and behavior…', error: 'The observation station signal was interrupted', retry: 'Reconnect', tags: ['Energy Level', 'Potential Barrier', 'Quantum Behavior', 'Quantum Leap'] },
      continue: 'Click anywhere to continue',
      finish: 'Click anywhere to finish',
      close: 'End observation',
      tabs: 'Dimensions'
    },
    states: {
      good: { name: 'Low-energy stable state', visual: 'Low energy · coherent lock' },
      superposition: { name: 'Superposition', visual: 'Superposition · phase unlocked' },
      danger: { name: 'High-energy unstable state', visual: 'High energy · decoherence' }
    },
    energyLead: 'You have just opened the {dim} quantum ball.',
    barrierLead: 'A barrier is not the enemy. It is the resistance you are actually meeting right now.',
    ladderLead: 'Quantum energy does not climb smoothly; it jumps in steps.',
    behaviorLead: 'This dimension is sustaining itself in a particular way.',
    leapLead: 'A leap is not being pushed. It is an optional, gentle displacement.',
    fourLead: 'You are not one of four personality types. Four dimensions are sitting at different energy levels at the same time.',
    currentLevel: 'Current level n={level}; stability: {stability}.',
    sections: {
      energy: 'Energy Level',
      barrier: 'Potential Barrier',
      ladder: 'Quantum Energy Ladder',
      behavior: 'Quantum Behavior',
      leap: 'Quantum Leap',
      four: 'Four-Dimensional Field'
    },
    energyState: {
      PO: { good: 'Low-energy stable state', superposition: 'Door-gap superposition', danger: 'High-energy scattering state' },
      II: { good: 'Sustained excited state', superposition: 'Dual-frequency transition', danger: 'Energy-leak state' },
      LA: { good: 'Superconducting state', superposition: 'Path superposition', danger: 'Orbital decoherence' },
      UR: { good: 'Coherent ground state', superposition: 'Tunneling superposition', danger: 'High-energy dissipation' }
    },
    energyNote: 'This is not a good-or-bad judgement. It is simply where your energy sits right now.',
    barrier: {
      PO: 'The barrier is not a sign that you are not brave enough. It is the hesitation your body produces when there is not enough known signal beyond the door. Let the wall exist for now; only then can the door be seen again.',
      II: 'The barrier is not laziness. It is the friction created when meaning, passion and external demands are not on the same frequency. The harder the push, the louder the noise.',
      LA: 'The barrier comes from the pull between being arranged and wanting to walk your own route. You have not been given enough autonomous space, so your orbit keeps being rewritten by external instructions.',
      UR: 'The barrier is your recovery speed lagging behind the size of the challenge. Uncertainty itself is draining energy; recovering is not the same as retreating.'
    },
    barrierState: {
      good: 'The wall is not high, but it is real. You do not have to pretend it is not there.',
      superposition: 'The wall moves between two possibilities; you want to cross, but you also do not want to lose the way back.',
      danger: 'The wall is high right now. Hitting it head-on will leak more energy; allowing it to exist is part of reducing the loss.'
    },
    barrierNote: 'The barrier does not need to be overcome right now. Let it exist first, so that “I must solve this immediately” stops draining you.',
    behavior: {
      PO: 'You use weak measurement: instead of pushing the door open, you listen at the gap, watch the dust, and test the direction of the wind. By not forcing a result, you keep more possibilities alive.',
      II: 'You use pulsed excitation: lighting the fire in bursts rather than burning continuously. The pauses are not failure; they are how your energy is supplied right now.',
      LA: 'You use mode switching: moving between autonomy and external instruction, using different modes to keep moving forward.',
      UR: 'You use quantum tunneling: rather than smashing the wall, you pass through its thinnest place. Humor, retreat and grit are all tunneling paths.'
    },
    behaviorType: {
      good: 'This strategy is working right now; it keeps your energy from dissipating for nothing.',
      superposition: 'This strategy keeps two routes open, but it also makes it hard to lock onto one.',
      danger: 'This strategy is helping you survive while also consuming you. It deserves to be seen, not blamed.'
    },
    behaviorNote: 'This is a survival strategy grown from your current energy state, not a defect.',
    leap: {
      PO: 'If you are willing, you do not have to open the door next time. Just put your ear to the gap, listen for one second, and then decide whether to continue.',
      II: 'If you are willing, do not rush to relight the fire. Just ask yourself: what is still worth adding one more measure of fuel to?',
      LA: 'If you are willing, do not plan the whole road. Draw only the next point, and allow yourself to walk just that far.',
      UR: 'If you are willing, do not solve uncertainty yet. Let yourself stand in the fog for a while and notice which patch of ground is steady.'
    },
    leapState: {
      good: 'You do not need to jump far; you are already on a sustainable orbit.',
      superposition: 'You do not need to kill one side of the possibility now; let the next observation become clearer first.',
      danger: 'You do not need to leap immediately. Letting the energy stop leaking is already the next step.'
    },
    leapNote: 'This is not advice and not a requirement. It is an open invitation: you can jump now, or you can wait.',
    pageKickers: ['ENERGY LEVEL', 'POTENTIAL BARRIER', 'ENERGY LADDER', 'QUANTUM BEHAVIOR', 'QUANTUM LEAP', 'FOUR-DIMENSIONAL FIELD'],
    pageTitles: ['Your {dim} · Energy Level', 'Potential Barrier', 'Quantum Energy Ladder', 'Quantum Behavior', 'Quantum Leap', 'The Four-Dimensional Field'],
    stateBody: {
      PO: {
        good: 'Your potential quantum ball is locked at a relatively low energy level. It is no longer bouncing everywhere; its energy is gathered into a few directions it genuinely wants to explore.',
        superposition: 'Your potential quantum ball sits between two energy levels: the familiar console on one side, the unopened door on the other. It has not been observed into a single state yet, so both possibilities remain.',
        danger: 'Your potential quantum ball is in a high-energy unstable state, leaking energy through the cracks. It is not that you lack potential; the observation direction is too scattered for the ball to find a stable orbit.'
      },
      II: {
        good: 'Your intrinsic-interest quantum ball is in a low-energy stable state, with focused and sustained energy. It does not need constant external fuel to keep burning.',
        superposition: 'Your intrinsic-interest quantum ball keeps jumping between two levels: sometimes lit by meaning, sometimes falling back to standby. It needs one clear enough observation to collapse into a sustained-burning level.',
        danger: 'Your intrinsic-interest quantum ball is leaking energy; passion and meaning are not on the same frequency. It is not that you have no drive, but the drive signal is buried in noise.'
      },
      LA: {
        good: 'Your learning-agency quantum ball has formed a stable orbit; it can allocate its own energy. You do not need to be pushed at every step to keep a direction.',
        superposition: 'Your learning-agency quantum ball is in superposition: part of it wants to plan independently, part is still waiting for external instructions. Both modes exist, and the way you observe it will decide where it collapses.',
        danger: 'Your learning-agency quantum ball is unstable, and its orbit is easily interrupted by the outside. It is not that you cannot be autonomous; the current energy is not yet enough to sustain a route of your own.'
      },
      UR: {
        good: 'Your uncertainty-response quantum ball is in a low-energy stable state and remains coherent in the face of uncertainty. You can keep walking through fog without forcing every answer to appear at once.',
        superposition: 'Your uncertainty-response quantum ball is layered between two reactions: wanting to rush in, and wanting to step back. It has not yet been fixed by a safe enough observation.',
        danger: 'Your uncertainty-response quantum ball is in a high-energy unstable state, and energy dissipates quickly when uncertainty appears. It is not that you are not brave; your current resilience has not caught up with the size of the challenge.'
      }
    },
    guidance: {
      title: 'Guidance tendency',
      clear: { label: 'Formed', body: 'This dimension already has a clear direction. Guidance here is more like tuning a frequency: there is no need to broadcast a new signal, only to align with the existing one.' },
      forming: { label: 'Forming', body: 'The ball already leans somewhere, but it is not fully locked. One good enough observation could help it collapse toward a clearer direction.' },
      weak: { label: 'Not yet formed', body: 'The ball is still drifting between several levels. Giving an answer too early would interrupt its own observation; let the direction develop first.' },
      blocked: { label: 'Temporarily blocked', body: 'Energy is leaking and the signal is covered by noise. Restoring stability matters more than adding more force.' }
    },
    ladder: {
      title: 'Quantum energy ladder',
      levels: ['n=1 ground', 'n=2 excited', 'n=3 coherent', 'n=4 high energy', 'n=5 transition'],
      body: 'Your {dim} quantum ball currently sits at level n={level}. Quantum energy does not climb smoothly; it jumps in steps. The next level is n={next}.',
      foot: 'Energy jumps in steps · each observation allows one stable landing'
    },
    quantum: {
      title: 'Quantum translation',
      good: 'Low energy level + high coherence = a stable direction with energy concentrated in a few orbits.',
      superposition: 'Superposition + unlocked phase = several possibilities coexist; the way you observe decides where it collapses.',
      danger: 'High energy level + decoherence = energy leaks and the signal is buried in noise. Reduce the noise before talking about a jump.'
    },
    four: {
      title: 'Four-dimensional quantum field',
      sub: 'All four dimension balls exist at once. Click any one to switch the observation.'
    }
  };

  window.QBTI_STATUS_TEXT = { 'zh-CN': ZH, 'zh-TW': ZH, en: EN };
})();
