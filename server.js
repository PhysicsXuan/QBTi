/* ============================================================
   QBTI 后端服务器（Neon PostgreSQL 数据库版）
   - 使用 AgentMail 发送验证码
   - 数据持久化：Neon 提供的免费 PostgreSQL
   ============================================================ */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.static(__dirname));

/* ---------- 配置 ---------- */
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';
const DATABASE_URL = process.env.DATABASE_URL;

if (!AGENTMAIL_API_KEY) {
  console.log('⚠️  未配置 AGENTMAIL_API_KEY，验证码将打印在控制台');
} else {
  console.log('✅ AgentMail 已配置');
}

if (!DATABASE_URL) {
  console.log('❌ 严重警告：未配置 DATABASE_URL！数据将无法保存。');
} else {
  console.log('✅ PostgreSQL 连接字符串已配置');
}

/* ---------- 数据库连接池 ---------- */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 监听连接池的错误，防止服务崩溃
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池异常:', err.message);
});

/* ---------- 初始化数据库表 ---------- */
async function initDB() {
  if (!DATABASE_URL) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS parents (
      email VARCHAR(255) PRIMARY KEY,
      phone VARCHAR(20),
      username VARCHAR(100) NOT NULL,
      salt VARCHAR(255) NOT NULL,
      "passwordHash" VARCHAR(255) NOT NULL,
      "createdAt" BIGINT
    );`,
    `CREATE TABLE IF NOT EXISTS bindings (
      id SERIAL PRIMARY KEY,
      "studentEmail" VARCHAR(255) NOT NULL,
      "studentUsername" VARCHAR(100),
      "parentEmail" VARCHAR(255) NOT NULL,
      "boundAt" BIGINT NOT NULL,
      UNIQUE("studentEmail", "parentEmail")
    );`,
    `CREATE TABLE IF NOT EXISTS invites (
      code VARCHAR(10) PRIMARY KEY,
      "studentEmail" VARCHAR(255) NOT NULL,
      "studentUsername" VARCHAR(100),
      "createdAt" BIGINT NOT NULL,
      "expiresAt" BIGINT NOT NULL,
      used BOOLEAN DEFAULT FALSE
    );`,
    `CREATE TABLE IF NOT EXISTS reports (
      "studentEmail" VARCHAR(255) PRIMARY KEY,
      "studentUsername" VARCHAR(100),
      payload JSONB,
      "updatedAt" BIGINT NOT NULL
    );`
  ];
  try {
    for (let q of queries) {
      await pool.query(q);
    }
    console.log('✅ 数据库表检查/初始化完成');
  } catch (err) {
    console.error('❌ 数据库表初始化失败:', err.message);
  }
}

/* ---------- 工具函数 ---------- */
function hashPassword(pw, salt) {
  return crypto.createHash('sha256').update(pw + ':' + salt).digest('hex');
}
function genSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function genInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ---------- AgentMail ---------- */
let inboxId = null;

async function ensureInbox() {
  if (!AGENTMAIL_API_KEY) return null;
  if (inboxId) return inboxId;
  try {
    const listRes = await fetch(AGENTMAIL_BASE + '/inboxes', {
      headers: { 'Authorization': 'Bearer ' + AGENTMAIL_API_KEY }
    });
    let inboxes = [];
    try {
      const listData = await listRes.json();
      inboxes = listData.inboxes || listData.data || (Array.isArray(listData) ? listData : []);
    } catch (e) {}
    if (inboxes.length > 0) {
      inboxId = inboxes[0].inboxId || inboxes[0].id || inboxes[0].inbox_id;
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
    return inboxId;
  } catch (err) {
    console.error('[AgentMail] ensureInbox 异常:', err.message);
    return null;
  }
}

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

/* ---------- 验证码存储（内存即可） ---------- */
const codeStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now && (now - val.lastSentAt) > 10 * 60 * 1000) codeStore.delete(key);
  }
}, 60 * 1000);

/* ============================================================
   API: 发送验证码
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

  console.log(`[验证码] ${target} -> ${code}`);

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
   API: 校验验证码（学生注册用）
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
   API: 家长注册 / 登录
   ============================================================ */
app.post('/api/parent/register', async (req, res) => {
  const { email, phone, code, username, password } = req.body || {};
  if (!email || !phone || !code || !username || !password) {
    return res.status(400).json({ error: '参数不完整' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度 2-20' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

  const emailLower = email.toLowerCase().trim();

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

  try {
    const check = await pool.query('SELECT email FROM parents WHERE email = $1', [emailLower]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: '该邮箱已注册为家长账号' });
    }

    const salt = genSalt();
    const passwordHash = hashPassword(password, salt);
    const createdAt = Date.now();

    await pool.query(
      `INSERT INTO parents (email, phone, username, salt, "passwordHash", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [emailLower, phone, username, salt, passwordHash, createdAt]
    );

    console.log('[Parent] 新家长注册:', emailLower);
    res.json({ success: true, user: { email: emailLower, phone, username, createdAt } });
  } catch (err) {
    console.error('[DB] 注册家长失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.post('/api/parent/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: '参数不完整' });
  const id = String(identifier).trim().toLowerCase();

  try {
    const result = await pool.query('SELECT * FROM parents WHERE email = $1', [id]);
    const parent = result.rows[0];
    if (!parent) return res.status(404).json({ error: '账号不存在' });
    
    if (hashPassword(password, parent.salt) !== parent.passwordHash) {
      return res.status(401).json({ error: '密码不正确' });
    }
    
    res.json({
      success: true,
      user: { email: parent.email, phone: parent.phone, username: parent.username, createdAt: Number(parent.createdAt) }
    });
  } catch (err) {
    console.error('[DB] 家长登录失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

/* ============================================================
   API: 学生端 - 绑定系统
   ============================================================ */
app.post('/api/bind/generate', async (req, res) => {
  const { studentEmail, studentUsername } = req.body || {};
  if (!studentEmail) return res.status(400).json({ error: '缺少学生邮箱' });
  const se = String(studentEmail).trim().toLowerCase();

  try {
    // 检查上限
    const countRes = await pool.query('SELECT COUNT(*) FROM bindings WHERE "studentEmail" = $1', [se]);
    const boundCount = parseInt(countRes.rows[0].count, 10);
    if (boundCount >= 2) {
      return res.status(409).json({ error: '已达到绑定上限（最多绑定 2 位家长）' });
    }

    // 清理该学生旧的未使用邀请码
    await pool.query('DELETE FROM invites WHERE "studentEmail" = $1 AND used = false', [se]);

    const code = genInviteCode();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await pool.query(
      `INSERT INTO invites (code, "studentEmail", "studentUsername", "createdAt", "expiresAt", used)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [code, se, studentUsername || '', now, expiresAt]
    );

    console.log('[Bind] 生成邀请码', code, '→ 学生', se);
    res.json({ success: true, code, expiresAt, boundCount, maxBound: 2 });
  } catch (err) {
    console.error('[DB] 生成邀请码失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.get('/api/bind/list/:studentEmail', async (req, res) => {
  const se = String(req.params.studentEmail || '').trim().toLowerCase();
  if (!se) return res.status(400).json({ error: '缺少邮箱' });

  try {
    const result = await pool.query(`
      SELECT b."parentEmail", p.username AS "parentUsername", b."boundAt"
      FROM bindings b
      LEFT JOIN parents p ON b."parentEmail" = p.email
      WHERE b."studentEmail" = $1
      ORDER BY b."boundAt" ASC
    `, [se]);

    res.json({ success: true, list: result.rows, count: result.rows.length, max: 2 });
  } catch (err) {
    console.error('[DB] 获取绑定列表失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.post('/api/bind/remove', async (req, res) => {
  const { studentEmail, parentEmail } = req.body || {};
  if (!studentEmail || !parentEmail) return res.status(400).json({ error: '参数不完整' });
  const se = String(studentEmail).trim().toLowerCase();
  const pe = String(parentEmail).trim().toLowerCase();

  try {
    const result = await pool.query('DELETE FROM bindings WHERE "studentEmail" = $1 AND "parentEmail" = $2 RETURNING id', [se, pe]);
    if (result.rowCount === 0) return res.status(404).json({ error: '绑定不存在' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DB] 解绑失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

/* ============================================================
   API: 家长端 - 绑定与报告
   ============================================================ */
app.post('/api/bind/accept', async (req, res) => {
  const { parentEmail, code } = req.body || {};
  if (!parentEmail || !code) return res.status(400).json({ error: '参数不完整' });
  const pe = String(parentEmail).trim().toLowerCase();
  const c = String(code).trim().toUpperCase();

  try {
    const pCheck = await pool.query('SELECT email FROM parents WHERE email = $1', [pe]);
    if (pCheck.rows.length === 0) return res.status(404).json({ error: '家长账号不存在' });

    const invRes = await pool.query('SELECT * FROM invites WHERE code = $1', [c]);
    const inv = invRes.rows[0];
    if (!inv) return res.status(404).json({ error: '邀请码不存在' });
    if (inv.used) return res.status(410).json({ error: '邀请码已被使用' });
    if (Number(inv.expiresAt) < Date.now()) {
      await pool.query('DELETE FROM invites WHERE code = $1', [c]);
      return res.status(410).json({ error: '邀请码已过期' });
    }

    const se = inv.studentEmail;
    const countRes = await pool.query('SELECT COUNT(*) FROM bindings WHERE "studentEmail" = $1', [se]);
    if (parseInt(countRes.rows[0].count, 10) >= 2) {
      return res.status(409).json({ error: '该学生已达到绑定上限' });
    }

    const bindCheck = await pool.query('SELECT id FROM bindings WHERE "studentEmail" = $1 AND "parentEmail" = $2', [se, pe]);
    if (bindCheck.rows.length > 0) {
      await pool.query('UPDATE invites SET used = true WHERE code = $1', [c]);
      return res.status(409).json({ error: '您已绑定该学生' });
    }

    // 执行绑定并消耗邀请码
    await pool.query(
      `INSERT INTO bindings ("studentEmail", "studentUsername", "parentEmail", "boundAt") 
       VALUES ($1, $2, $3, $4)`,
      [se, inv.studentUsername || '', pe, Date.now()]
    );
    await pool.query('UPDATE invites SET used = true WHERE code = $1', [c]);

    console.log('[Bind] 家长', pe, '绑定学生', se);
    res.json({ success: true, studentEmail: se, studentUsername: inv.studentUsername || '' });
  } catch (err) {
    console.error('[DB] 绑定操作失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.get('/api/parent/students', async (req, res) => {
  const pe = String(req.query.email || '').trim().toLowerCase();
  if (!pe) return res.status(400).json({ error: '缺少邮箱' });

  try {
    const result = await pool.query(`
      SELECT 
        b."studentEmail", b."studentUsername", b."boundAt",
        r."updatedAt" AS "reportUpdatedAt"
      FROM bindings b
      LEFT JOIN reports r ON b."studentEmail" = r."studentEmail"
      WHERE b."parentEmail" = $1
      ORDER BY b."boundAt" DESC
    `, [pe]);

    const list = result.rows.map(row => ({
      studentEmail: row.studentEmail,
      studentUsername: row.studentUsername,
      boundAt: Number(row.boundAt),
      hasReport: !!row.reportUpdatedAt,
      reportUpdatedAt: row.reportUpdatedAt ? Number(row.reportUpdatedAt) : null
    }));

    res.json({ success: true, list });
  } catch (err) {
    console.error('[DB] 获取家长学生列表失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

/* ============================================================
   API: 报告同步与获取
   ============================================================ */
app.post('/api/report/sync', async (req, res) => {
  const { studentEmail, studentUsername, payload } = req.body || {};
  if (!studentEmail || !payload) return res.status(400).json({ error: '参数不完整' });
  const se = String(studentEmail).trim().toLowerCase();
  const updatedAt = Date.now();

  try {
    await pool.query(
      `INSERT INTO reports ("studentEmail", "studentUsername", payload, "updatedAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("studentEmail") DO UPDATE 
       SET "studentUsername" = EXCLUDED."studentUsername",
           payload = EXCLUDED.payload,
           "updatedAt" = EXCLUDED."updatedAt"`,
      [se, studentUsername || '', JSON.stringify(payload), updatedAt]
    );
    console.log('[Report] 已同步', se, payload.code);
    res.json({ success: true, updatedAt });
  } catch (err) {
    console.error('[DB] 同步报告失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.get('/api/parent/report/:studentEmail', async (req, res) => {
  const se = String(req.params.studentEmail || '').trim().toLowerCase();
  const pe = String(req.query.parentEmail || '').trim().toLowerCase();
  if (!se || !pe) return res.status(400).json({ error: '参数不完整' });

  try {
    const bindCheck = await pool.query('SELECT id FROM bindings WHERE "studentEmail" = $1 AND "parentEmail" = $2', [se, pe]);
    if (bindCheck.rows.length === 0) return res.status(403).json({ error: '未绑定该学生' });

    const repRes = await pool.query('SELECT * FROM reports WHERE "studentEmail" = $1', [se]);
    const r = repRes.rows[0];
    if (!r) return res.status(404).json({ error: '该学生尚未提交报告' });

    res.json({
      success: true,
      report: {
        studentEmail: r.studentEmail,
        studentUsername: r.studentUsername,
        payload: r.payload,
        updatedAt: Number(r.updatedAt)
      }
    });
  } catch (err) {
    console.error('[DB] 获取报告失败:', err);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

/* ============================================================
   健康检查 & 路由
   ============================================================ */
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    if (DATABASE_URL) {
      await pool.query('SELECT 1');
      dbOk = true;
    }
  } catch (e) {}

  res.json({
    ok: true,
    mailer: !!AGENTMAIL_API_KEY,
    database: dbOk ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/parent', (req, res) => res.sendFile(path.join(__dirname, 'parent.html')));

app.listen(PORT, async () => {
  console.log('');
  console.log('===========================================');
  console.log('  QBTI 服务器已启动');
  console.log('  端口: ' + PORT);
  console.log('  邮件: ' + (AGENTMAIL_API_KEY ? '✅ 已启用' : '⚠️  未配置'));
  console.log('  数据库: ' + (DATABASE_URL ? '✅ 已配置' : '❌ 未配置'));
  console.log('===========================================');
  console.log('');
  
  // 启动时自动建表
  await initDB();
});