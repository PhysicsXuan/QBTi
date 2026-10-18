/* ============================================================
   QBTI 后端服务器
   - AgentMail 发验证码（学生/家长共用）
   - 家长账号存储（服务端 JSON）
   - 学生 ↔ 家长 绑定系统（最多 2 位家长）
   - 学生报告同步 + 家长查询
   ============================================================ */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

/* ---------- 配置 ---------- */
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

if (!AGENTMAIL_API_KEY) {
  console.log('⚠️  未配置 AGENTMAIL_API_KEY，验证码将打印在控制台');
} else {
  console.log('✅ AgentMail 已配置');
}

/* ---------- 文件持久化 ---------- */
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[Store] 读取失败', file, e.message);
    return fallback;
  }
}
function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[Store] 写入失败', file, e.message);
  }
}

const PARENTS_FILE  = path.join(DATA_DIR, 'parents.json');
const BINDINGS_FILE = path.join(DATA_DIR, 'bindings.json');
const INVITES_FILE  = path.join(DATA_DIR, 'invites.json');
const REPORTS_FILE  = path.join(DATA_DIR, 'reports.json');

let parents  = loadJSON(PARENTS_FILE,  {});   // { email: {email, phone, username, salt, passwordHash, createdAt} }
let bindings = loadJSON(BINDINGS_FILE, []);   // [{ studentEmail, studentUsername, parentEmail, boundAt }]
let invites  = loadJSON(INVITES_FILE,  {});   // { code: {studentEmail, studentUsername, createdAt, expiresAt, used} }
let reports  = loadJSON(REPORTS_FILE,  {});   // { studentEmail: {studentEmail, studentUsername, payload, updatedAt} }

const saveParents  = () => saveJSON(PARENTS_FILE,  parents);
const saveBindings = () => saveJSON(BINDINGS_FILE, bindings);
const saveInvites  = () => saveJSON(INVITES_FILE,  invites);
const saveReports  = () => saveJSON(REPORTS_FILE,  reports);

/* ---------- 密码 & 邀请码 ---------- */
function hashPassword(pw, salt) {
  return crypto.createHash('sha256').update(pw + ':' + salt).digest('hex');
}
function genSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function genInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (invites[code]);
  return code;
}

/* 清理过期邀请码 */
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const code of Object.keys(invites)) {
    if (invites[code].expiresAt < now) {
      delete invites[code];
      changed = true;
    }
  }
  if (changed) saveInvites();
}, 5 * 60 * 1000);

/* ---------- AgentMail ---------- */
let inboxId = null;
let inboxAddress = null;

async function ensureInbox() {
  if (!AGENTMAIL_API_KEY) return null;
  if (inboxId) return inboxId;
  try {
    const listRes = await fetch(AGENTMAIL_BASE + '/inboxes', {
      headers: { 'Authorization': 'Bearer ' + AGENTMAIL_API_KEY }
    });
    const listText = await listRes.text();
    console.log('[AgentMail] 查询 inbox:', listRes.status);
    let inboxes = [];
    try {
      const listData = JSON.parse(listText);
      inboxes = listData.inboxes || listData.data || (Array.isArray(listData) ? listData : []);
    } catch (e) {}
    if (inboxes.length > 0) {
      inboxId = inboxes[0].inboxId || inboxes[0].id || inboxes[0].inbox_id;
      inboxAddress = inboxes[0].address || inboxes[0].email || inboxId;
      return inboxId;
    }
    const createRes = await fetch(AGENTMAIL_BASE + '/inboxes', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + AGENTMAIL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (!createRes.ok) return null;
    const created = await createRes.json();
    inboxId = created.inboxId || created.id || created.inbox_id;
    inboxAddress = created.address || created.email || inboxId;
    console.log('[AgentMail] 新建 inbox:', inboxId);
    return inboxId;
  } catch (err) {
    console.error('[AgentMail] ensureInbox 异常:', err.message);
    return null;
  }
}
setTimeout(() => { ensureInbox(); }, 1000);

async function sendCodeEmail(to, code) {
  if (!AGENTMAIL_API_KEY) return { ok: false };
  const inbox = await ensureInbox();
  if (!inbox) return { ok: false };
  try {
    const sendRes = await fetch(
      AGENTMAIL_BASE + '/inboxes/' + inbox + '/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + AGENTMAIL_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          subject: '【QBTI】你的验证码',
          html: [
            '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0B0D1C;color:#E9EBFF;border-radius:16px;">',
            '  <h2 style="color:#fff;margin-bottom:16px;">验证你的邮箱</h2>',
            '  <p style="color:#8B90B8;line-height:1.6;">你的 QBTI 验证码：</p>',
            '  <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#FF8A48;margin:24px 0;text-align:center;">' + code + '</div>',
            '  <p style="color:#8B90B8;font-size:13px;">5 分钟内有效。</p>',
            '</div>'
          ].join('\n')
        })
      }
    );
    return { ok: sendRes.ok };
  } catch (err) {
    console.error('[AgentMail] 发送异常:', err.message);
    return { ok: false };
  }
}

/* ---------- 验证码存储 ---------- */
const codeStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now && (now - val.lastSentAt) > 10 * 60 * 1000) codeStore.delete(key);
  }
}, 60 * 1000);

/* ============================================================
   POST /api/send-code  （学生/家长共用）
   ============================================================ */
app.post('/api/send-code', async (req, res) => {
  const { email, phone } = req.body || {};
  const target = email ? 'email:' + email.toLowerCase().trim()
                     : phone ? 'phone:' + phone.trim() : null;
  if (!target) return res.status(400).json({ error: '缺少邮箱或手机号' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  const now = Date.now();
  const existing = codeStore.get(target);
  if (existing && (now - existing.lastSentAt) < 60 * 1000) {
    const wait = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: '请 ' + wait + ' 秒后再试' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  codeStore.set(target, {
    code, expiresAt: now + 5 * 60 * 1000, attempts: 0, lastSentAt: now
  });

  console.log('');
  console.log('========================================');
  console.log('  [验证码] ' + target);
  console.log('  验证码：' + code + '  （5 分钟内有效）');
  console.log('========================================');

  if (email && AGENTMAIL_API_KEY) {
    const r = await sendCodeEmail(email, code);
    if (!r.ok) return res.status(500).json({ error: '邮件发送失败' });
  }

  const isDev = !AGENTMAIL_API_KEY;
  res.json({
    success: true,
    message: isDev ? '验证码已生成，请查看服务端控制台' : '验证码已发送到你的邮箱',
    devCode: isDev ? code : undefined
  });
});

/* ============================================================
   POST /api/verify-code  （学生注册时独立调用）
   ============================================================ */
app.post('/api/verify-code', (req, res) => {
  const { email, phone, code } = req.body || {};
  const target = email ? 'email:' + email.toLowerCase().trim()
                     : phone ? 'phone:' + phone.trim() : null;
  if (!target || !code) return res.status(400).json({ error: '参数不完整' });

  const entry = codeStore.get(target);
  if (!entry) return res.status(400).json({ error: '请先发送验证码' });
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(target);
    return res.status(400).json({ error: '验证码已过期' });
  }
  if (entry.attempts >= 5) {
    codeStore.delete(target);
    return res.status(400).json({ error: '错误次数过多' });
  }
  if (entry.code !== String(code)) {
    entry.attempts++;
    return res.status(400).json({ error: '验证码不正确' });
  }
  codeStore.delete(target);
  res.json({ success: true });
});

/* ============================================================
   家长注册 / 登录
   ============================================================ */
app.post('/api/parent/register', (req, res) => {
  const { email, phone, code, username, password } = req.body || {};
  if (!email || !phone || !code || !username || !password) {
    return res.status(400).json({ error: '参数不完整' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度 2-20' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

  const emailLower = email.toLowerCase().trim();
  if (parents[emailLower]) return res.status(409).json({ error: '该邮箱已注册为家长账号' });

  // 验证码校验
  const target = 'email:' + emailLower;
  const entry = codeStore.get(target);
  if (!entry) return res.status(400).json({ error: '请先发送验证码' });
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(target);
    return res.status(400).json({ error: '验证码已过期' });
  }
  if (entry.attempts >= 5) {
    codeStore.delete(target);
    return res.status(400).json({ error: '错误次数过多' });
  }
  if (entry.code !== String(code)) {
    entry.attempts++;
    return res.status(400).json({ error: '验证码不正确' });
  }
  codeStore.delete(target);

  const salt = genSalt();
  const parent = {
    email: emailLower,
    phone,
    username,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: Date.now()
  };
  parents[emailLower] = parent;
  saveParents();
  console.log('[Parent] 新家长注册:', emailLower, username);

  res.json({
    success: true,
    user: {
      email: parent.email,
      phone: parent.phone,
      username: parent.username,
      createdAt: parent.createdAt
    }
  });
});

app.post('/api/parent/login', (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: '参数不完整' });
  const id = String(identifier).trim().toLowerCase();
  const parent = parents[id];
  if (!parent) return res.status(404).json({ error: '账号不存在' });
  if (hashPassword(password, parent.salt) !== parent.passwordHash) {
    return res.status(401).json({ error: '密码不正确' });
  }
  res.json({
    success: true,
    user: {
      email: parent.email,
      phone: parent.phone,
      username: parent.username,
      createdAt: parent.createdAt
    }
  });
});

/* ============================================================
   学生端：生成绑定邀请码
   ============================================================ */
app.post('/api/bind/generate', (req, res) => {
  const { studentEmail, studentUsername } = req.body || {};
  if (!studentEmail) return res.status(400).json({ error: '缺少学生邮箱' });
  const se = String(studentEmail).trim().toLowerCase();

  const boundCount = bindings.filter(b => b.studentEmail === se).length;
  if (boundCount >= 2) {
    return res.status(409).json({ error: '已达到绑定上限（最多绑定 2 位家长）' });
  }

  // 清理该学生旧的未使用邀请码
  for (const code of Object.keys(invites)) {
    if (invites[code].studentEmail === se && !invites[code].used) {
      delete invites[code];
    }
  }

  const code = genInviteCode();
  const now = Date.now();
  invites[code] = {
    code,
    studentEmail: se,
    studentUsername: studentUsername || '',
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,
    used: false
  };
  saveInvites();
  console.log('[Bind] 生成邀请码', code, '→ 学生', se);

  res.json({
    success: true,
    code,
    expiresAt: invites[code].expiresAt,
    boundCount,
    maxBound: 2
  });
});

/* ============================================================
   学生端：查看已绑定的家长
   ============================================================ */
app.get('/api/bind/list/:studentEmail', (req, res) => {
  const se = String(req.params.studentEmail || '').trim().toLowerCase();
  if (!se) return res.status(400).json({ error: '缺少邮箱' });
  const list = bindings
    .filter(b => b.studentEmail === se)
    .map(b => {
      const p = parents[b.parentEmail];
      return {
        parentEmail: b.parentEmail,
        parentUsername: p ? p.username : '未知家长',
        boundAt: b.boundAt
      };
    });
  res.json({ success: true, list, count: list.length, max: 2 });
});

/* ============================================================
   学生端：解绑家长
   ============================================================ */
app.post('/api/bind/remove', (req, res) => {
  const { studentEmail, parentEmail } = req.body || {};
  if (!studentEmail || !parentEmail) return res.status(400).json({ error: '参数不完整' });
  const se = String(studentEmail).trim().toLowerCase();
  const pe = String(parentEmail).trim().toLowerCase();
  const idx = bindings.findIndex(b => b.studentEmail === se && b.parentEmail === pe);
  if (idx < 0) return res.status(404).json({ error: '绑定不存在' });
  bindings.splice(idx, 1);
  saveBindings();
  res.json({ success: true });
});

/* ============================================================
   家长端：接受绑定邀请码
   ============================================================ */
app.post('/api/bind/accept', (req, res) => {
  const { parentEmail, code } = req.body || {};
  if (!parentEmail || !code) return res.status(400).json({ error: '参数不完整' });
  const pe = String(parentEmail).trim().toLowerCase();
  const c = String(code).trim().toUpperCase();

  const parent = parents[pe];
  if (!parent) return res.status(404).json({ error: '家长账号不存在' });

  const inv = invites[c];
  if (!inv) return res.status(404).json({ error: '邀请码不存在' });
  if (inv.used) return res.status(410).json({ error: '邀请码已被使用' });
  if (inv.expiresAt < Date.now()) {
    delete invites[c];
    saveInvites();
    return res.status(410).json({ error: '邀请码已过期' });
  }

  const se = inv.studentEmail;
  const boundCount = bindings.filter(b => b.studentEmail === se).length;
  if (boundCount >= 2) return res.status(409).json({ error: '该学生已达到绑定上限' });

  if (bindings.some(b => b.studentEmail === se && b.parentEmail === pe)) {
    inv.used = true;
    saveInvites();
    return res.status(409).json({ error: '您已绑定该学生' });
  }

  bindings.push({
    studentEmail: se,
    studentUsername: inv.studentUsername || '',
    parentEmail: pe,
    boundAt: Date.now()
  });
  saveBindings();

  inv.used = true;
  saveInvites();
  console.log('[Bind] 家长', pe, '绑定学生', se);

  res.json({
    success: true,
    studentEmail: se,
    studentUsername: inv.studentUsername || ''
  });
});

/* ============================================================
   家长端：查看已绑定的学生列表
   ============================================================ */
app.get('/api/parent/students', (req, res) => {
  const pe = String(req.query.email || '').trim().toLowerCase();
  if (!pe) return res.status(400).json({ error: '缺少邮箱' });
  const list = bindings
    .filter(b => b.parentEmail === pe)
    .map(b => ({
      studentEmail: b.studentEmail,
      studentUsername: b.studentUsername || '',
      boundAt: b.boundAt,
      hasReport: !!reports[b.studentEmail],
      reportUpdatedAt: reports[b.studentEmail] ? reports[b.studentEmail].updatedAt : null
    }));
  res.json({ success: true, list });
});

/* ============================================================
   学生端：同步报告
   ============================================================ */
app.post('/api/report/sync', (req, res) => {
  const { studentEmail, studentUsername, payload } = req.body || {};
  if (!studentEmail || !payload) return res.status(400).json({ error: '参数不完整' });
  const se = String(studentEmail).trim().toLowerCase();
  reports[se] = {
    studentEmail: se,
    studentUsername: studentUsername || '',
    payload,
    updatedAt: Date.now()
  };
  saveReports();
  console.log('[Report] 已同步', se, payload.code);
  res.json({ success: true, updatedAt: reports[se].updatedAt });
});

/* ============================================================
   家长端：查看某学生的最新报告
   ============================================================ */
app.get('/api/parent/report/:studentEmail', (req, res) => {
  const se = String(req.params.studentEmail || '').trim().toLowerCase();
  const pe = String(req.query.parentEmail || '').trim().toLowerCase();
  if (!se || !pe) return res.status(400).json({ error: '参数不完整' });

  if (!bindings.some(b => b.studentEmail === se && b.parentEmail === pe)) {
    return res.status(403).json({ error: '未绑定该学生' });
  }
  const r = reports[se];
  if (!r) return res.status(404).json({ error: '该学生尚未提交报告' });
  res.json({ success: true, report: r });
});

/* ============================================================
   健康检查 & 路由
   ============================================================ */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mailer: !!AGENTMAIL_API_KEY,
    inbox: inboxId,
    parents: Object.keys(parents).length,
    bindings: bindings.length,
    reports: Object.keys(reports).length
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/parent', (req, res) => res.sendFile(path.join(__dirname, 'parent.html')));

app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('  QBTI 本地服务器已启动');
  console.log('  学生端：http://localhost:' + PORT);
  console.log('  家长端：http://localhost:' + PORT + '/parent');
  console.log('  邮件：' + (AGENTMAIL_API_KEY ? '✅ AgentMail 已启用' : '⚠️  未配置'));
  console.log('===========================================');
  console.log('');
});