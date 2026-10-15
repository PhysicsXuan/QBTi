/* ============================================================
   QBTI Core —— 纯逻辑模块，无任何 DOM 依赖
   暴露全局：window.QBTI
   ============================================================ */
window.QBTI = (function(){
  'use strict';

  const SUBDIMS = [
    { id:'X', dim:'PO', name:'探索欲' },{ id:'C', dim:'PO', name:'创造' },{ id:'A', dim:'PO', name:'适应' },
    { id:'U', dim:'II', name:'好奇' },{ id:'P', dim:'II', name:'热情' },{ id:'M', dim:'II', name:'意义' },
    { id:'I', dim:'LA', name:'主动' },{ id:'D', dim:'LA', name:'独立' },{ id:'E', dim:'LA', name:'坚持' },
    { id:'T', dim:'UR', name:'容忍' },{ id:'H', dim:'UR', name:'挑战' },{ id:'R', dim:'UR', name:'韧性' }
  ];
  const DIMS = [
    { id:'PO', name:'潜能开放度', en:'Potential Openness', letters:['X','C','A'] },
    { id:'II', name:'内在驱动力', en:'Intrinsic Interest', letters:['U','P','M'] },
    { id:'LA', name:'学习自主性', en:'Learning Agency', letters:['I','D','E'] },
    { id:'UR', name:'未知应对方式', en:'Uncertainty Response', letters:['T','H','R'] }
  ];
  const DIM_COLORS = {
    PO:{X:'#7C5CFF',C:'#4A9EFF',A:'#00E5FF'},
    II:{U:'#FF6B9D',P:'#FFA94D',M:'#FFD93D'},
    LA:{I:'#6BCB77',D:'#4ECDC4',E:'#45B7D1'},
    UR:{T:'#FF6B6B',H:'#C77DFF',R:'#F7B801'}
  };
  const SUFFIXES = [
    { letter:'E', name:'探索型', desc:'通过不断进入新领域、新问题、新可能性来发展自己。' },
    { letter:'D', name:'深耕型', desc:'通过在一个方向上长期投入、持续深入来发展自己。' },
    { letter:'I', name:'融合型', desc:'通过连接不同知识、领域和方法来发展自己。' },
    { letter:'A', name:'实践型', desc:'通过把想法转化为具体行动、作品和成果来发展自己。' }
  ];

  const TYPE_NAMES = {
    'XUIT':'寻知者','XUIH':'探险家','XUIR':'拓荒者','XUDT':'问道者','XUDH':'探路者','XUDR':'求索者',
    'XUET':'漫游者','XUEH':'冒险家','XUER':'开拓者',
    'XPIT':'逐梦者','XPIH':'实验家','XPIR':'探索者','XPDT':'求真者','XPDH':'研行者','XPDR':'深耕者',
    'XPET':'逐趣者','XPEH':'冒险家','XPER':'拓界者',
    'XMIT':'理想家','XMIH':'先行者','XMIR':'坚守者','XMDT':'问道士','XMDH':'探真者','XMDR':'求道者',
    'XMET':'漫思者','XMEH':'理想行者','XMER':'拓道者',
    'CUIT':'创想家','CUIH':'发明家','CUIR':'革新者','CUDT':'构思者','CUDH':'设计师','CUDR':'匠心者',
    'CUET':'奇思者','CUEH':'破局者','CUER':'创新者',
    'CPIT':'创作者','CPIH':'造梦师','CPIR':'匠人','CPDT':'构建者','CPDH':'工程师','CPDR':'造物者',
    'CPET':'灵感家','CPEH':'革界者','CPER':'造世者',
    'CMIT':'思想家','CMIH':'变革者','CMIR':'理想匠','CMDT':'构想家','CMDH':'改革家','CMDR':'建设者',
    'CMET':'哲思者','CMEH':'创变者','CMER':'拓新者',
    'AUIT':'应变者','AUIH':'破浪者','AUIR':'韧行者','AUDT':'随行者','AUDH':'应战者','AUDR':'持变者',
    'AUET':'游弋者','AUEH':'闯荡者','AUER':'流变者',
    'APIT':'行动派','APIH':'挑战者','APIR':'进取者','APDT':'协作者','APDH':'应战家','APDR':'进化者',
    'APET':'追风者','APEH':'冲锋者','APER':'跃迁者',
    'AMIT':'行者','AMIH':'破界者','AMIR':'守望者','AMDT':'明道者','AMDH':'改革者','AMDR':'坚行者',
    'AMET':'随变者','AMEH':'拓变者','AMER':'蜕变者'
  };

  const QUESTIONS = [
    {id:1,group:1,depth:'shallow',text:'我会对自己从未接触过的领域产生兴趣，即使我暂时不知道它有什么用。',dims:{X:1},sfxCoeff:[+1.00,-0.35,+0.55,-0.40]},
    {id:2,group:1,depth:'shallow',text:'面对一道题目时，我经常会想到一种与课堂上讲过的方法不同的解法。',dims:{C:1},sfxCoeff:[+0.35,-0.25,+1.00,+0.20]},
    {id:3,group:1,depth:'shallow',text:'如果原本熟悉的学习方式发生变化，我通常能够比较快地找到新的方法。',dims:{A:1},sfxCoeff:[-0.25,+0.15,+0.55,+1.00]},
    {id:4,group:1,depth:'shallow',text:'相比于反复练习自己已经擅长的事情，我更愿意偶尔尝试完全陌生的事情。',dims:{X:1},sfxCoeff:[+1.00,-0.55,+0.30,-0.20]},
    {id:5,group:1,depth:'shallow',text:'我认为一道题有不止一种合理的思考方式，是一件很有意思的事情。',dims:{C:1},sfxCoeff:[+0.45,-0.25,+1.00,+0.15]},
    {id:6,group:1,depth:'deep',text:'如果一个问题没有明确的答案，我仍然愿意花很长时间弄清楚它到底能不能被解决。',dims:{X:2,T:1},sfxCoeff:[+1.00,+0.55,+0.30,-0.35]},
    {id:7,group:1,depth:'deep',text:'当别人告诉我「通常应该这样做」时，我仍然会思考有没有完全不同的做法。',dims:{C:2},sfxCoeff:[+0.65,-0.25,+1.00,+0.10]},
    {id:8,group:1,depth:'deep',text:'如果一种原本有效的方法突然失效，我能够放弃原来的思路并重新设计解决方案。',dims:{A:2},sfxCoeff:[-0.20,+0.25,+0.65,+1.00]},
    {id:9,group:1,depth:'core',text:'即使一个新领域一开始让我感到陌生甚至有些困难，我也不会因此轻易失去兴趣。',dims:{X:1.5,R:1.5},sfxCoeff:[+1.00,+0.65,+0.15,-0.35]},
    {id:10,group:1,depth:'core',text:'当一个问题没有现成的方法可以套用时，我反而更容易产生自己的思路。',dims:{C:1.5,T:1.5},sfxCoeff:[+0.55,-0.30,+1.00,+0.40]},
    {id:11,group:2,depth:'shallow',text:'当我学到一个新知识时，我通常会想知道它为什么会这样，而不仅仅是记住结论。',dims:{U:1},sfxCoeff:[+0.65,+0.10,+1.00,-0.30]},
    {id:12,group:2,depth:'shallow',text:'如果一个主题真的让我感兴趣，我可以在没有别人要求的情况下主动花很多时间研究它。',dims:{P:1},sfxCoeff:[+0.30,+1.00,+0.25,+0.20]},
    {id:13,group:2,depth:'shallow',text:'如果我理解了一件事情「为什么值得做」，我通常会更愿意投入时间。',dims:{M:1},sfxCoeff:[-0.20,+0.65,+0.40,+1.00]},
    {id:14,group:2,depth:'shallow',text:'我经常会因为一个看似不起眼的问题，而产生「如果……会怎么样？」这样的想法。',dims:{U:1},sfxCoeff:[+1.00,-0.20,+0.70,-0.25]},
    {id:15,group:2,depth:'shallow',text:'对于自己真正喜欢的事情，我通常能够保持比较长时间的兴趣。',dims:{P:1},sfxCoeff:[-0.20,+1.00,+0.30,+0.45]},
    {id:16,group:2,depth:'deep',text:'如果老师只告诉我一个公式，却没有解释它为什么成立，我通常会觉得这还不够。',dims:{U:2},sfxCoeff:[+0.70,+0.40,+1.00,-0.30]},
    {id:17,group:2,depth:'deep',text:'即使一件事情没有考试、排名或奖励，只要我认为它值得做，我仍然愿意认真完成。',dims:{M:1.5,P:1.5},sfxCoeff:[-0.25,+0.85,+0.25,+1.00]},
    {id:18,group:2,depth:'deep',text:'我曾经因为一个自己真正感兴趣的问题，自发地查资料、看视频或寻找其他学习资源。',dims:{P:1.5,U:1.5},sfxCoeff:[+0.60,+1.00,+0.35,+0.55]},
    {id:19,group:2,depth:'core',text:'如果一项任务与我认为重要的事情没有关系，我很难长时间保持投入。',dims:{M:3},sfxCoeff:[+0.20,+1.00,+0.25,+0.70],reverse:true},
    {id:20,group:2,depth:'core',text:'当我真正对一个问题产生兴趣时，即使过程中不断遇到新的问题，我也会想继续追下去。',dims:{P:1.5,U:1.5,R:1},sfxCoeff:[+0.65,+1.00,+0.35,+0.20]},
    {id:21,group:3,depth:'shallow',text:'如果没有人提醒，我通常也能够主动开始完成自己的学习任务。',dims:{I:1},sfxCoeff:[-0.25,+0.45,+0.30,+1.00]},
    {id:22,group:3,depth:'shallow',text:'面对一个自己已经学过的内容，我通常可以不依赖老师一步一步地带着我完成。',dims:{D:1},sfxCoeff:[+0.10,+1.00,+0.55,+0.65]},
    {id:23,group:3,depth:'shallow',text:'当学习过程中遇到暂时解决不了的问题时，我通常不会马上放弃。',dims:{E:1},sfxCoeff:[+0.25,+1.00,+0.15,+0.55]},
    {id:24,group:3,depth:'shallow',text:'我习惯自己安排什么时候学习什么内容，而不是完全按照别人给出的安排进行。',dims:{I:0.5,D:0.5},sfxCoeff:[+0.20,+0.75,+0.30,+1.00]},
    {id:25,group:3,depth:'shallow',text:'当别人没有告诉我下一步该做什么时，我通常也能自己找到事情继续做下去。',dims:{D:1},sfxCoeff:[+0.45,+1.00,+0.35,+0.75]},
    {id:26,group:3,depth:'deep',text:'如果一项任务不会计入成绩，我仍然可能因为自己想做好它而认真完成。',dims:{I:1.5,M:1.5},sfxCoeff:[+0.10,+0.80,+0.30,+1.00]},
    {id:27,group:3,depth:'deep',text:'当我发现老师给出的解决方法无法解决一个新问题时，我会尝试自己建立一套方法。',dims:{D:1.5,C:1.5},sfxCoeff:[+0.45,+0.55,+1.00,+0.70]},
    {id:28,group:3,depth:'deep',text:'如果一个目标需要持续几周甚至几个月才能完成，我仍然能够维持自己的行动。',dims:{E:2},sfxCoeff:[-0.15,+1.00,+0.20,+0.70]},
    {id:29,group:3,depth:'core',text:'当我连续几次尝试都没有得到想要的结果时，我通常会重新调整方法，而不是直接停止。',dims:{E:1.5,A:1.5,R:1.5},sfxCoeff:[+0.20,+1.00,+0.70,+0.85]},
    {id:30,group:3,depth:'core',text:'如果没有任何人监督我的进度，我仍然能够为了一个自己设定的目标持续投入。',dims:{I:1.5,D:1.5,E:1.5},sfxCoeff:[+0.15,+1.00,+0.45,+0.85]},
    {id:31,group:4,depth:'shallow',text:'我并不介意暂时不知道一个问题的答案。',dims:{T:1},sfxCoeff:[+1.00,+0.35,+0.65,-0.30]},
    {id:32,group:4,depth:'shallow',text:'面对一个明显比平时困难的任务，我通常会有兴趣尝试一下。',dims:{H:1},sfxCoeff:[+0.65,+0.35,+0.20,+1.00]},
    {id:33,group:4,depth:'shallow',text:'一次失败并不会让我很长时间不愿意再次尝试类似的事情。',dims:{R:1},sfxCoeff:[+0.15,+0.75,+0.35,+1.00]},
    {id:34,group:4,depth:'shallow',text:'如果一个任务没有明确的评分标准，我仍然可以比较自在地完成它。',dims:{T:1},sfxCoeff:[+1.00,+0.20,+0.55,+0.10]},
    {id:35,group:4,depth:'shallow',text:'相比于选择一个我已经很有把握完成的任务，我有时更愿意挑战难度更高的任务。',dims:{H:1},sfxCoeff:[+0.55,+0.25,+0.15,+1.00]},
    {id:36,group:4,depth:'deep',text:'如果我花了很长时间仍然没有找到答案，我仍然可以接受「暂时没有答案」这种状态。',dims:{T:2.5},sfxCoeff:[+1.00,+0.55,+0.40,-0.30]},
    {id:37,group:4,depth:'deep',text:'当一个问题明显超出我目前的能力范围时，我反而会想看看自己究竟能做到什么程度。',dims:{H:2.5},sfxCoeff:[+0.65,+0.25,+0.30,+1.00]},
    {id:38,group:4,depth:'deep',text:'如果一次重要的尝试失败了，我通常能够在总结原因之后重新开始。',dims:{R:2.5},sfxCoeff:[+0.10,+0.75,+0.40,+1.00]},
    {id:39,group:4,depth:'core',text:'在没有标准答案、没有现成步骤、甚至不知道自己是否能成功的情况下，我仍然愿意继续探索。',dims:{T:1.5,H:1.5,R:1.5},sfxCoeff:[+1.00,+0.55,+0.60,+0.25]},
    {id:40,group:4,depth:'core',text:'越是可能失败、结果越不确定的任务，我越希望亲自试试看。',dims:{H:1.5,R:1.5,T:1.5},sfxCoeff:[+0.70,+0.35,+0.20,+1.00]}
  ];
  const OPTIONS = [{v:1,t:'非常不同意'},{v:2,t:'比较不同意'},{v:3,t:'不确定 / 一般'},{v:4,t:'比较同意'},{v:5,t:'非常同意'}];

  const DEPTH_MULT = {shallow:1.00, deep:1.80, core:2.50};
  const SFX_BASE = {E:100.13, D:100.07, I:99.97, A:99.83};
  const SUB_PERTURB = {X:0.00031,C:0.00017,A:0.00007,U:0.00029,P:0.00013,M:0.00005,I:0.00027,D:0.00019,E:0.00011,T:0.00023,H:0.00015,R:0.00009};
  const TEMP = 8;

  function makeTypeImage(code){
    let h=5381;for(let i=0;i<code.length;i++)h=((h<<5)+h+code.charCodeAt(i))|0;h=Math.abs(h);
    const hue=h%360,hue2=(hue+120)%360,hue3=(hue+240)%360;
    const c1='hsl('+hue+',85%,62%)',c2='hsl('+hue2+',85%,58%)',c3='hsl('+hue3+',85%,58%)';
    const r1=70+(h%30),r2=46+((h>>3)%24),rot=(h%60)-30;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 210">'
      +'<defs><radialGradient id="a" cx="38%" cy="32%" r="72%">'
      +'<stop offset="0%" stop-color="'+c1+'" stop-opacity=".95"/>'
      +'<stop offset="60%" stop-color="'+c2+'" stop-opacity=".35"/>'
      +'<stop offset="100%" stop-color="'+c3+'" stop-opacity=".06"/>'
      +'</radialGradient>'
      +'<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0%" stop-color="'+c2+'"/><stop offset="100%" stop-color="'+c3+'"/>'
      +'</linearGradient></defs>'
      +'<g transform="translate(140 100)">'
      +'<circle r="'+r1+'" fill="url(#a)" opacity=".85"/>'
      +'<circle r="'+r1+'" fill="none" stroke="url(#b)" stroke-width="1.6" opacity=".85"/>'
      +'<g transform="rotate('+rot+')">'
      +'<circle r="'+r2+'" fill="none" stroke="'+c1+'" stroke-width="1.4" opacity=".9"/>'
      +'<ellipse rx="'+(r1-4)+'" ry="'+(r2-6)+'" fill="none" stroke="'+c3+'" stroke-width="1.1" opacity=".55" transform="rotate(28)"/>'
      +'<ellipse rx="'+(r2+4)+'" ry="'+(r1-8)+'" fill="none" stroke="'+c2+'" stroke-width="1" opacity=".45" transform="rotate(-22)"/>'
      +'</g>'
      +'<circle r="7" fill="url(#b)"/><circle r="3" fill="#fff" opacity=".95"/>'
      +'</g></svg>';
    return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
  }

  function answerFingerprint(answers){
    let h=5381;
    for(let i=1;i<=40;i++){const v=answers[i]||0;h=((h<<5)+h+v*(i*7+13))|0;}
    return Math.abs(h);
  }
  function seededUnit(seed, idx){
    const x = Math.sin(seed*0.0001 + idx*12.9898)*43758.5453;
    return x - Math.floor(x);
  }

  function computeResult(answers){
    const dimArr = {}; SUBDIMS.forEach(s=>dimArr[s.id]=[]);
    let E_raw=0,D_raw=0,I_raw=0,A_raw=0;
    QUESTIONS.forEach(q=>{
      const ans = answers[q.id]; if(ans==null) return;
      const mult = DEPTH_MULT[q.depth]||1;
      for(const dim in q.dims){
        const subW = q.dims[dim];
        dimArr[dim].push({value:ans, weight:mult*subW, depth:q.depth});
      }
      let centered = ans - 3;
      if(q.reverse) centered = -centered;
      if(q.sfxCoeff){
        const c = q.sfxCoeff;
        E_raw += centered*c[0]*mult; D_raw += centered*c[1]*mult;
        I_raw += centered*c[2]*mult; A_raw += centered*c[3]*mult;
      }
    });
    const baseScore={},deepScore={},consistencyScore={};
    SUBDIMS.forEach(s=>{
      const arr = dimArr[s.id];
      if(arr.length===0){baseScore[s.id]=50;deepScore[s.id]=50;consistencyScore[s.id]=50;return;}
      let sumW=0,sumWV=0;
      arr.forEach(a=>{sumW+=a.weight;sumWV+=a.value*a.weight;});
      baseScore[s.id]=(sumWV/sumW-1)/4*100;
      const deepArr = arr.filter(a=>a.depth==='deep'||a.depth==='core');
      if(deepArr.length>0){
        let dW=0,dWV=0;
        deepArr.forEach(a=>{dW+=a.weight;dWV+=a.value*a.weight;});
        deepScore[s.id]=(dWV/dW-1)/4*100;
      } else deepScore[s.id]=baseScore[s.id];
      const values = arr.map(a=>a.value);
      const mean = values.reduce((a,b)=>a+b,0)/values.length;
      const variance = values.reduce((a,v)=>a+Math.pow(v-mean,2),0)/values.length;
      const std = Math.sqrt(variance);
      consistencyScore[s.id]=Math.max(0,(1-std/2)*100);
    });
    const dominanceScore = {};
    SUBDIMS.forEach(s=>{dominanceScore[s.id]=baseScore[s.id]*0.5+deepScore[s.id]*0.35+consistencyScore[s.id]*0.15;});
    const dimGroupRatio = {}, dimLeadInfo = {};
    DIMS.forEach(d=>{
      const letters = d.letters;
      const finalScores = letters.map(l=>dominanceScore[l]+SUB_PERTURB[l]);
      const maxS = Math.max.apply(null, finalScores);
      const exps = finalScores.map(s=>Math.exp((s-maxS)/TEMP));
      const sumExp = exps.reduce((a,b)=>a+b,0);
      const probs = exps.map(e=>e/sumExp*100);
      let leadIdx=0;
      probs.forEach((p,i)=>{if(p>probs[leadIdx])leadIdx=i;});
      const rounded = probs.map(p=>Math.round(p));
      const sumR = rounded.reduce((a,b)=>a+b,0);
      if(sumR!==100) rounded[leadIdx] += (100-sumR);
      dimGroupRatio[d.id]={};
      letters.forEach((l,i)=>{dimGroupRatio[d.id][l]=rounded[i];});
      const lead = letters[leadIdx];
      const leadPct = rounded[leadIdx];
      const otherPcts = rounded.filter((_,i)=>i!==leadIdx);
      const gap = leadPct - Math.max.apply(null, otherPcts);
      let stability;
      if(gap>=12) stability='clear'; else if(gap>=6) stability='moderate'; else stability='weak';
      dimLeadInfo[d.id]={lead,gap,stability};
    });
    const letters = DIMS.map(d=>dimLeadInfo[d.id].lead);
    let E_final=SFX_BASE.E+E_raw, D_final=SFX_BASE.D+D_raw, I_final=SFX_BASE.I+I_raw, A_final=SFX_BASE.A+A_raw;
    const minVal = Math.min(E_final,D_final,I_final,A_final);
    E_final-=minVal-1; D_final-=minVal-1; I_final-=minVal-1; A_final-=minVal-1;
    const totalRaw = E_final+D_final+I_final+A_final;
    let pctFloat = {E:E_final/totalRaw*100,D:D_final/totalRaw*100,I:I_final/totalRaw*100,A:A_final/totalRaw*100};
    const sfxKeys = ['E','D','I','A'];
    const MIN_GAP = 1.0;
    let sortedKeys = sfxKeys.slice().sort((a,b)=>pctFloat[b]-pctFloat[a]);
    for(let i=1;i<sortedKeys.length;i++){
      const hi=sortedKeys[i-1], lo=sortedKeys[i];
      if(pctFloat[hi]-pctFloat[lo]<MIN_GAP){
        const mid=(pctFloat[hi]+pctFloat[lo])/2;
        pctFloat[hi]=mid+MIN_GAP/2; pctFloat[lo]=mid-MIN_GAP/2;
      }
    }
    const sumAfterGap = sfxKeys.reduce((a,k)=>a+pctFloat[k],0);
    sfxKeys.forEach(k=>{pctFloat[k]=pctFloat[k]/sumAfterGap*100;});
    let sfxRounded = {};
    sfxKeys.forEach(k=>{sfxRounded[k]=Math.round(pctFloat[k]);});
    let sfxSum = sfxKeys.reduce((a,k)=>a+sfxRounded[k],0);
    if(sfxSum!==100){
      const maxKey = sfxKeys.reduce((a,b)=>sfxRounded[a]>=sfxRounded[b]?a:b);
      sfxRounded[maxKey] += (100-sfxSum);
    }
    const fp = answerFingerprint(answers);
    let safety = 30;
    while(safety-- > 0){
      const seen = {}; let dupPair = null;
      for(const k of sfxKeys){
        if(seen[sfxRounded[k]]!==undefined){dupPair=[seen[sfxRounded[k]],k];break;}
        seen[sfxRounded[k]]=k;
      }
      if(!dupPair) break;
      const [k1,k2]=dupPair;
      const order = (seededUnit(fp,k1.charCodeAt(0))>seededUnit(fp,k2.charCodeAt(0)))?[k1,k2]:[k2,k1];
      const [winner,loser]=order;
      sfxRounded[winner]+=1;
      if(sfxRounded[loser]>3) sfxRounded[loser]-=1;
      else{
        const third = sfxKeys.find(k=>k!==winner&&k!==loser&&sfxRounded[k]>5);
        if(third) sfxRounded[third]-=1; else sfxRounded[loser]-=1;
      }
      let s = sfxKeys.reduce((a,k)=>a+sfxRounded[k],0);
      if(s!==100){
        const maxKey = sfxKeys.reduce((a,b)=>sfxRounded[a]>=sfxRounded[b]?a:b);
        sfxRounded[maxKey] += (100-s);
      }
    }
    const sortedSfx = sfxKeys.slice().sort((a,b)=>sfxRounded[b]-sfxRounded[a]);
    const bestSuffix = SUFFIXES.find(sf=>sf.letter===sortedSfx[0]);
    const suffixGap = sfxRounded[sortedSfx[0]]-sfxRounded[sortedSfx[1]];
    let suffixStability;
    if(suffixGap>=10) suffixStability='clear'; else if(suffixGap>=5) suffixStability='moderate'; else suffixStability='weak';
    return {baseScore,deepScore,consistencyScore,dominanceScore,letters,dimGroupRatio,dimLeadInfo,suffix:bestSuffix,suffixRatio:sfxRounded,suffixGap,suffixStability};
  }

  function escapeHTML(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function renderMD(text){
    let h = escapeHTML(text);
    h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    h = h.replace(/^#{1,3}\s*(.+)$/gm,'<h4>$1</h4>');
    h = h.replace(/(?:^[-•▸]\s+.+$\n?)+/gm,function(m){return '<ul>'+m.replace(/^[-•▸]\s+(.+)$/gm,'<li>$1</li>')+'</ul>';});
    h = h.split(/\n{2,}/).map(function(p){
      const t=p.trim();if(!t)return '';
      if(/^<(h4|ul|li)/.test(t))return t;
      return '<p>'+t.replace(/\n/g,'<br>')+'</p>';
    }).join('');
    return h;
  }
  function localReport(res){
    const sorted = SUBDIMS.slice().sort((a,b)=>res.dominanceScore[a.id]-res.dominanceScore[b.id]);
    const low3 = sorted.slice(0,3);
    const high3 = sorted.slice(-3).reverse();
    const baseCode = res.letters.join('');
    const typeName = TYPE_NAMES[baseCode]||'';
    const fullCode = baseCode+'-'+res.suffix.letter;
    return '【你的量子态画像】\n你的类型是 '+fullCode+' · '+typeName+'（'+res.suffix.name+'），'+res.suffix.desc+'\n最强的三个维度：'+high3.map(s=>s.name+'（'+res.dominanceScore[s.id].toFixed(1)+'）').join('、')+'。\n\n【你的能量势垒】\n相对较弱：'+low3.map(s=>s.name+'（'+res.dominanceScore[s.id].toFixed(1)+'）').join('、')+'。这些不是缺点，而是势垒。\n\n【量子隧穿路径】\n▸ 把任务切成 15 分钟的小块。\n▸ 找一个能立刻看到反馈的小项目。\n▸ 允许自己"跳过"。\n\n【给观测者的话】\n请给他一个不被评价的空间：不问成绩，只问"你今天对什么好奇"。';
  }
  function buildPrompt(res){
    const baseCode = res.letters.join('');
    const typeName = TYPE_NAMES[baseCode]||'';
    const fullCode = baseCode+'-'+res.suffix.letter;
    const dimLines = DIMS.map(d=>{
      const r = res.dimGroupRatio[d.id];
      const info = res.dimLeadInfo[d.id];
      return d.name+'：'+d.letters.map(l=>l+'='+r[l]+'%').join(' / ')+' → 主导 '+info.lead+'（差值 '+info.gap+'%）';
    }).join('\n');
    const vecLines = SUFFIXES.map(sf=>sf.letter+' '+sf.name+'：'+res.suffixRatio[sf.letter]+'%').join('\n');
    return '你是一位教育引导顾问，擅长用"量子态"隐喻理解青少年的学习状态。以下是某位学生完成的 QBTI 测评结果：\n'
      +'【人格代码】'+fullCode+'\n【类型名称】'+typeName+' · '+res.suffix.name+'\n'
      +'【四大维度倾向】\n'+dimLines+'\n【四个发展向量占比】\n'+vecLines+'\n'
      +'请输出约600-800字中文引导报告，含【你的量子态画像】【你的能量势垒】【量子隧穿路径】【给观测者的话】四部分。语气温暖、不评判、不说教。';
  }

  /* ==========================================================
     整体量子态分析
     ========================================================== */
  function analyzeQuantumState(res){
    let goodScore = 0, dangerScore = 0;
    const reasons = [];

    let clearCount=0, moderateCount=0, weakCount=0;
    DIMS.forEach(d=>{
      const s = res.dimLeadInfo[d.id].stability;
      if(s==='clear') clearCount++; else if(s==='moderate') moderateCount++; else weakCount++;
    });
    goodScore += clearCount * 1.1 + moderateCount * 0.4;
    dangerScore += weakCount * 1.3;
    if(weakCount >= 2) reasons.push('多个维度方向未明');
    if(clearCount >= 3) reasons.push('方向清晰');

    const M = res.dominanceScore.M, P = res.dominanceScore.P;
    if(M < 28){ dangerScore += 2.2; reasons.push('意义感偏低'); }
    else if(M > 58){ goodScore += 1.4; reasons.push('意义感强'); }
    if(P < 25){ dangerScore += 1.2; reasons.push('内在热情不足'); }
    else if(P > 58){ goodScore += 1.0; reasons.push('内在热情充沛'); }

    const I = res.dominanceScore.I, D = res.dominanceScore.D, E = res.dominanceScore.E;
    if(E < 28){ dangerScore += 2.2; reasons.push('长期坚持能力偏弱'); }
    else if(E > 58){ goodScore += 1.4; reasons.push('坚持能力强'); }
    if(I > 58) goodScore += 0.7;
    if(D > 58) goodScore += 0.7;

    const T = res.dominanceScore.T, H = res.dominanceScore.H, R = res.dominanceScore.R;
    if(T < 26){ dangerScore += 1.6; reasons.push('对不确定性容忍度偏低'); }
    else if(T > 58){ goodScore += 1.0; reasons.push('能容忍不确定'); }
    if(R < 26){ dangerScore += 1.8; reasons.push('受挫后恢复偏弱'); }
    else if(R > 58){ goodScore += 1.4; reasons.push('韧性良好'); }
    if(H > R + 18){ dangerScore += 1.5; reasons.push('挑战欲高于韧性'); }

    const veryLow = SUBDIMS.filter(s => res.dominanceScore[s.id] < 22).length;
    dangerScore += veryLow * 0.7;
    if(veryLow >= 2) reasons.push('多个维度处于低位');

    if(res.suffixGap > 28){ dangerScore += 1.0; reasons.push('发展路径过于集中'); }
    else if(res.suffixGap < 12){ goodScore += 0.6; }

    const diff = goodScore - dangerScore;
    let type;
    if(diff >= 2.5) type = 'good';
    else if(diff <= -1.2) type = 'danger';
    else type = 'superposition';

    return { type, goodScore, dangerScore, diff, reasons };
  }

  /* ==========================================================
     ★ 单维度量子态分析（PO / II / LA / UR 各自判定）
     ========================================================== */
  function analyzeDimensionState(res, dimId){
    const dim = DIMS.find(d => d.id === dimId);
    if(!dim) return { type:'superposition', goodScore:0, dangerScore:0, diff:0 };
    const letters = dim.letters;
    const scores = letters.map(l => res.dominanceScore[l]);
    const avg = scores.reduce((a,b)=>a+b,0)/3;
    const minScore = Math.min.apply(null, scores);
    const maxScore = Math.max.apply(null, scores);
    const range = maxScore - minScore;
    const info = res.dimLeadInfo[dimId];

    let good = 0, danger = 0;
    const reasons = [];

    // 平均分
    if(avg > 55){ good += 1.2; }
    else if(avg < 30){ danger += 1.5; reasons.push('整体偏低'); }
    else if(avg < 38){ danger += 0.7; }

    // 极低分
    if(minScore < 22){ danger += 1.8; reasons.push('存在极低子维度'); }
    else if(minScore < 28){ danger += 0.8; }

    // 高分
    if(maxScore > 62){ good += 1.0; }
    else if(maxScore > 55){ good += 0.5; }

    // 稳定性
    if(info.stability === 'clear'){ good += 0.8; }
    else if(info.stability === 'weak'){ danger += 1.0; reasons.push('方向未明'); }

    // 内部分散度
    if(range > 45){ danger += 0.8; reasons.push('内部失衡'); }
    else if(range < 18){ good += 0.3; }

    // 维度特有规则
    if(dimId === 'II'){
      const M = res.dominanceScore.M;
      const P = res.dominanceScore.P;
      if(M < 28){ danger += 1.8; reasons.push('意义感缺失'); }
      else if(M > 58){ good += 1.0; }
      if(P < 30 && M < 30){ danger += 1.0; reasons.push('热情与意义双低'); }
    }
    if(dimId === 'LA'){
      const E = res.dominanceScore.E;
      if(E < 28){ danger += 1.8; reasons.push('坚持力薄弱'); }
      else if(E > 58){ good += 1.2; }
      if(scores.filter(s=>s<32).length >= 2){ danger += 0.8; }
    }
    if(dimId === 'UR'){
      const R = res.dominanceScore.R, T = res.dominanceScore.T, H = res.dominanceScore.H;
      if(R < 26){ danger += 1.8; reasons.push('韧性不足'); }
      else if(R > 58){ good += 1.2; }
      if(T < 26){ danger += 1.2; reasons.push('难容忍不确定'); }
      if(H > R + 18){ danger += 1.2; reasons.push('敢闯却难恢复'); }
    }
    if(dimId === 'PO'){
      if(scores.filter(s=>s<30).length >= 2){ danger += 1.0; reasons.push('探索欲多维偏低'); }
      if(scores.filter(s=>s>55).length >= 2){ good += 0.8; }
    }

    const diff = good - danger;
    let type;
    if(diff >= 1.5) type = 'good';
    else if(diff <= -1.0) type = 'danger';
    else type = 'superposition';

    return { type, goodScore: good, dangerScore: danger, diff, avg, min: minScore, max: maxScore, range, reasons };
  }

  function analyzeDimensionStates(res){
    return {
      PO: analyzeDimensionState(res, 'PO'),
      II: analyzeDimensionState(res, 'II'),
      LA: analyzeDimensionState(res, 'LA'),
      UR: analyzeDimensionState(res, 'UR')
    };
  }

  return {
    SUBDIMS, DIMS, DIM_COLORS, SUFFIXES, TYPE_NAMES,
    QUESTIONS, OPTIONS,
    DEPTH_MULT, SFX_BASE, SUB_PERTURB, TEMP,
    makeTypeImage, computeResult, answerFingerprint,
    escapeHTML, renderMD, localReport, buildPrompt,
    analyzeQuantumState, analyzeDimensionState, analyzeDimensionStates
  };
})();