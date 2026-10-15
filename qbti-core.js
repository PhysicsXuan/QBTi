/* ==========================================================
   问卷有效性分析
   返回 { score, level, flags, details }
   score: 0-100，越高越可疑
   level: 'trust' | 'low' | 'medium' | 'high'
   ========================================================== */
function analyzeResponseValidity(answers, timings){
  const total = QUESTIONS.length;
  const vals = [];
  for(let i = 1; i <= total; i++){
    const v = answers[i];
    if(v == null) return { score: 100, level: 'high', flags: ['未完成全部题目'], details: {} };
    vals.push(v);
  }

  let suspicious = 0;
  const flags = [];

  /* 1. 选项分布 */
  const unique = new Set(vals).size;
  if(unique <= 2){ suspicious += 30; flags.push('几乎只使用 1–2 种选项'); }
  else if(unique <= 3){ suspicious += 15; flags.push('选项分布过于集中'); }

  /* 2. 波动 */
  const mean = vals.reduce((a,b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a,v) => a + Math.pow(v - mean, 2), 0) / vals.length;
  const std = Math.sqrt(variance);
  if(std < 0.45){ suspicious += 25; flags.push('作答几乎无波动'); }
  else if(std < 0.7){ suspicious += 10; flags.push('作答波动偏小'); }

  /* 3. 最长连续相同 */
  let maxRun = 1, run = 1;
  for(let i = 1; i < vals.length; i++){
    if(vals[i] === vals[i-1]){ run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  if(maxRun >= 12){ suspicious += 20; flags.push('存在长时间连续相同选择'); }
  else if(maxRun >= 8){ suspicious += 10; flags.push('存在较长连续相同选择'); }

  /* 4. 社会赞许 */
  const highRatio = vals.filter(v => v >= 4).length / vals.length;
  if(highRatio > 0.92){ suspicious += 20; flags.push('几乎全部选择同意/非常同意'); }
  else if(highRatio > 0.82){ suspicious += 10; flags.push('同意比例偏高'); }
  const lowRatio = vals.filter(v => v <= 2).length / vals.length;
  if(lowRatio > 0.90){ suspicious += 20; flags.push('几乎全部选择不同意'); }

  /* 5. 反向题一致性（第 19 题） */
  const M13 = answers[13], M17 = answers[17], M19 = answers[19];
  if(M13 != null && M17 != null && M19 != null){
    const m13High = M13 >= 4, m17High = M17 >= 4;
    const m19High = M19 >= 4;   // 第 19 题同意 = 低意义感
    if(m13High && m17High && m19High){
      suspicious += 25; flags.push('意义感题目与反向题存在明显矛盾');
    }
  }

  /* 6. 同维度题目矛盾 */
  const pairs = [
    [1,4], [2,7], [3,8],
    [11,16], [12,18], [13,17],
    [21,24], [22,25], [23,28],
    [31,36], [32,37], [33,38]
  ];
  let contradictions = 0;
  pairs.forEach(([a,b]) => {
    if(answers[a] != null && answers[b] != null){
      if(Math.abs(answers[a] - answers[b]) >= 3) contradictions++;
    }
  });
  if(contradictions >= 5){ suspicious += 20; flags.push('多组同维度题目答案差异过大'); }
  else if(contradictions >= 3){ suspicious += 10; flags.push('部分同维度题目答案不一致'); }

  /* 7. 作答时间 */
  if(timings && Object.keys(timings).length === total){
    const times = Object.values(timings);
    const avg = times.reduce((a,b) => a + b, 0) / times.length;
    const totalTime = times.reduce((a,b) => a + b, 0);
    if(avg < 1.5){ suspicious += 25; flags.push('平均作答时间过短'); }
    else if(avg < 2.5){ suspicious += 12; flags.push('平均作答时间偏短'); }
    if(totalTime < 180){ suspicious += 15; flags.push('总作答时间不足 3 分钟'); }
  }

  const score = Math.min(100, suspicious);
  let level;
  if(score >= 70) level = 'high';
  else if(score >= 45) level = 'medium';
  else if(score >= 25) level = 'low';
  else level = 'trust';

  return { score, level, flags, details: { std, unique, maxRun, highRatio, contradictions } };
}