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
    pageKickers: ['CURRENT EIGENSTATE', 'GUIDANCE TENDENCY', 'ENERGY LADDER', 'QUANTUM TRANSLATION', 'FOUR-DIMENSIONAL FIELD'],
    pageTitles: ['{dim}量子球', '它有没有引导倾向？', '能量停在第几阶？', '把大白话翻译成量子语言', '四维量子场'],
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
    pageKickers: ['CURRENT EIGENSTATE', 'GUIDANCE TENDENCY', 'ENERGY LADDER', 'QUANTUM TRANSLATION', 'FOUR-DIMENSIONAL FIELD'],
    pageTitles: ['Your {dim} quantum ball', 'Does it have a guidance tendency?', 'Which energy level is it on?', 'Translating plain language into quantum language', 'The four-dimensional quantum field'],
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
