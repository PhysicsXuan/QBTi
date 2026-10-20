/* ============================================================
   QBTI 学生端后端服务器（Neon PostgreSQL 数据库版 + 跨域支持）
   ============================================================ */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 开启 JSON 解析
app.use(express.json({ limit: '4mb' }));

// 2. 核心配置：允许跨域（让独立部署的家长端能够调用此服务器）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // 生产环境可改为家长端的指定域名
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 3. 托管学生端静态页面
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
    `CREATE TABLE IF NOT EXISTS student_emails (
      email VARCHAR(255) PRIMARY KEY,
      username VARCHAR(100),
      phone VARCHAR(20),
      salt VARCHAR(255),
      "passwordHash" VARCHAR(255),
      "createdAt" BIGINT
    );`,
    `ALTER TABLE student_emails ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`,
    `ALTER TABLE student_emails ADD COLUMN IF NOT EXISTS salt VARCHAR(255);`,
    `ALTER TABLE student_emails ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255);`,
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
    );`,
    `CREATE TABLE IF NOT EXISTS admin_policy (
      id VARCHAR(32) PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      salt VARCHAR(255) NOT NULL,
      "passwordHash" VARCHAR(255) NOT NULL,
      "updatedAt" BIGINT NOT NULL,
      "updatedBy" VARCHAR(255)
    );`,
    `CREATE TABLE IF NOT EXISTS admin_quiz_records (
      id SERIAL PRIMARY KEY,
      "studentEmail" VARCHAR(255) NOT NULL,
      "quizTs" BIGINT NOT NULL,
      payload JSONB,
      "createdAt" BIGINT NOT NULL,
      UNIQUE("studentEmail", "quizTs")
    );`
  ];
  try {
    for (let q of queries) {
      await pool.query(q);
    }
    const salt = genSalt();
    await pool.query(
      `INSERT INTO admin_policy (id, enabled, salt, "passwordHash", "updatedAt", "updatedBy")
       VALUES ('student_admin', TRUE, $1, $2, $3, 'system')
       ON CONFLICT (id) DO NOTHING`,
      [salt, hashStudentPassword('admin123456', salt), Date.now()]
    );
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

/* ---------- 学生密码：scrypt（新账号） ---------- */
const SCRYPT_PREFIX = 'scrypt$';
function hashStudentPassword(password, salt) {
  const hash = crypto.scryptSync(String(password), String(salt), 64).toString('hex');
  return SCRYPT_PREFIX + hash;
}
function verifyStudentPassword(password, salt, stored) {
  if (!stored || !salt) return false;
  try {
    if (String(stored).indexOf(SCRYPT_PREFIX) === 0) {
      const expected = Buffer.from(String(stored).slice(SCRYPT_PREFIX.length), 'hex');
      const actual = crypto.scryptSync(String(password), String(salt), 64);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }
    /* 兼容旧的 SHA-256 账户 */
    const legacy = Buffer.from(hashPassword(password, salt), 'hex');
    const storedBuf = Buffer.from(String(stored), 'hex');
    return legacy.length === storedBuf.length && crypto.timingSafeEqual(legacy, storedBuf);
  } catch (err) {
    return false;
  }
}

/* ---------- 学生端管理员 token（受家长端策略控制） ---------- */
const studentAdminTokens = new Map();
const STUDENT_ADMIN_TTL = 2 * 60 * 60 * 1000;
function studentAdminTokenFromReq(req){
  const h = String(req.headers.authorization || '');
  if(h.indexOf('Bearer ') === 0) return h.slice(7).trim();
  return String(req.headers['x-admin-token'] || '');
}

/* ---------- 验证码消费（注册 / 重置密码共用） ---------- */
function checkCode(target, code) {
  const entry = codeStore.get(target);
  if (!entry) return { ok: false, error: '请先发送验证码' };
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(target);
    return { ok: false, error: '验证码已过期' };
  }
  if (entry.attempts >= 5) {
    codeStore.delete(target);
    return { ok: false, error: '错误次数过多' };
  }
  if (entry.code !== String(code)) {
    entry.attempts++;
    return { ok: false, error: '验证码不正确' };
  }
  codeStore.delete(target);
  return { ok: true };
}

/* ---------- AgentMail 发信 ---------- */
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

/* ---------- 验证码内存存储 ---------- */
const codeStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now && (now - val.lastSentAt) > 10 * 60 * 1000) codeStore.delete(key);
  }
}, 60 * 1000);

/* ============================================================
   API 接口实现
   ============================================================ */

// 1. 邮箱角色排他检查
app.get('/api/check-email', async (req, res) => {
  const { email, role } = req.query;
  if(!email || !role) return res.status(400).json({ error: '参数不完整' });
  const targetEmail = email.toLowerCase().trim();

  try {
    if (role === 'student') {
      const r = await pool.query('SELECT email FROM parents WHERE email = $1', [targetEmail]);
      if (r.rows.length > 0) return res.json({ available: false, msg: '该邮箱已注册为家长账号，请勿重复注册' });
    } else if (role === 'parent') {
      const r = await pool.query('SELECT email FROM student_emails WHERE email = $1', [targetEmail]);
      if (r.rows.length > 0) return res.json({ available: false, msg: '该邮箱已注册为学生账号，请勿重复注册' });
    }
    res.json({ available: true });
  } catch(err) {
    res.status(500).json({ error: '服务器异常' });
  }
});

// 2. 学生邮箱同步
app.post('/api/student/sync', async (req, res) => {
  const { email, username } = req.body;
  if (!email) return res.status(400).json({ error: '参数不完整' });
  const targetEmail = email.toLowerCase().trim();
  try {
    await pool.query(
      `INSERT INTO student_emails (email, username, "createdAt") 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO NOTHING`,
      [targetEmail, username || '', Date.now()]
    );
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: '同步失败' });
  }
});

// 3. 发送验证码
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

// 4. 校验验证码（学生端）
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
   学生账户（服务器侧，支持跨设备登录）
   ============================================================ */

// 4.1 学生注册 / 旧账号首次设置密码
app.post('/api/student/register', async (req, res) => {
  const { email, phone, username, password, code } = req.body || {};
  const emailLower = String(email || '').toLowerCase().trim();
  const uname = String(username || '').trim();
  const tel = String(phone || '').trim();
  const pw = String(password || '');

  if (!emailLower || !uname || !pw || !code) {
    return res.status(400).json({ error: '参数不完整', code: 'BAD_REQUEST' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: '邮箱格式不正确', code: 'BAD_REQUEST' });
  }
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(uname)) {
    return res.status(400).json({ error: '用户名 2-20 位（字母/数字/下划线/中文）', code: 'BAD_REQUEST' });
  }
  if (pw.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位', code: 'BAD_REQUEST' });
  }
  if (tel && !/^1[3-9]\d{9}$/.test(tel)) {
    return res.status(400).json({ error: '手机号格式不正确', code: 'BAD_REQUEST' });
  }
  if (uname.toLowerCase() === 'administrator' || emailLower === 'administrator@qbti.local') {
    return res.status(400).json({ error: '该账号为系统保留', code: 'BAD_REQUEST' });
  }

  const checked = checkCode('email:' + emailLower, code);
  if (!checked.ok) return res.status(400).json({ error: checked.error, code: 'CODE_INVALID' });

  try {
    const parentCheck = await pool.query('SELECT email FROM parents WHERE email = $1', [emailLower]);
    if (parentCheck.rows.length > 0) {
      return res.status(409).json({ error: '该邮箱已注册为家长账号，不能同时注册为学生', code: 'PARENT_EMAIL' });
    }

    const existing = await pool.query(
      'SELECT email, "passwordHash", "createdAt" FROM student_emails WHERE email = $1',
      [emailLower]
    );
    if (existing.rows.length > 0 && existing.rows[0].passwordHash) {
      return res.status(409).json({ error: '该邮箱已注册，请直接登录或使用忘记密码', code: 'EMAIL_EXISTS' });
    }

    const nameCheck = await pool.query(
      'SELECT email FROM student_emails WHERE LOWER(username) = LOWER($1) AND email <> $2',
      [uname, emailLower]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({ error: '该用户名已被占用', code: 'USERNAME_TAKEN' });
    }

    const salt = genSalt();
    const passwordHash = hashStudentPassword(pw, salt);
    let createdAt = Date.now();

    if (existing.rows.length > 0) {
      createdAt = Number(existing.rows[0].createdAt) || createdAt;
      await pool.query(
        `UPDATE student_emails
         SET username = $1, phone = $2, salt = $3, "passwordHash" = $4
         WHERE email = $5`,
        [uname, tel, salt, passwordHash, emailLower]
      );
    } else {
      await pool.query(
        `INSERT INTO student_emails (email, username, phone, salt, "passwordHash", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [emailLower, uname, tel, salt, passwordHash, createdAt]
      );
    }

    res.json({
      success: true,
      user: { email: emailLower, phone: tel, username: uname, createdAt, role: 'student' }
    });
  } catch (err) {
    console.error('[学生注册] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.2 学生登录（邮箱或用户名 + 密码）
app.post('/api/student/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  const id = String(identifier || '').trim().toLowerCase();
  const pw = String(password || '');
  if (!id || !pw) return res.status(400).json({ error: '参数不完整', code: 'BAD_REQUEST' });

  try {
    let result;
    if (id.indexOf('@') >= 0) {
      result = await pool.query('SELECT * FROM student_emails WHERE LOWER(email) = $1', [id]);
    } else {
      result = await pool.query('SELECT * FROM student_emails WHERE LOWER(username) = $1', [id]);
      if (result.rows.length > 1) {
        return res.status(409).json({ error: '该用户名对应多个账号，请使用邮箱登录', code: 'AMBIGUOUS_USERNAME' });
      }
    }

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: '账号不存在', code: 'NOT_FOUND' });
    if (!user.passwordHash) {
      return res.status(409).json({ error: '该账号是旧版账号，请先用邮箱验证设置密码', code: 'NEED_PASSWORD_SETUP' });
    }
    if (!verifyStudentPassword(pw, user.salt, user.passwordHash)) {
      return res.status(401).json({ error: '密码不正确', code: 'WRONG_PASSWORD' });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        phone: user.phone || '',
        username: user.username || '',
        createdAt: Number(user.createdAt) || null,
        role: 'student'
      }
    });
  } catch (err) {
    console.error('[学生登录] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.3 学生重置密码（新设备/旧账号首次设置密码）
app.post('/api/student/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  const emailLower = String(email || '').toLowerCase().trim();
  const pw = String(newPassword || '');
  if (!emailLower || !code || !pw) {
    return res.status(400).json({ error: '参数不完整', code: 'BAD_REQUEST' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: '邮箱格式不正确', code: 'BAD_REQUEST' });
  }
  if (pw.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位', code: 'BAD_REQUEST' });
  }

  const checked = checkCode('email:' + emailLower, code);
  if (!checked.ok) return res.status(400).json({ error: checked.error, code: 'CODE_INVALID' });

  try {
    const existing = await pool.query('SELECT email FROM student_emails WHERE LOWER(email) = $1', [emailLower]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '该邮箱未注册学生账号', code: 'NOT_FOUND' });
    }

    const salt = genSalt();
    const passwordHash = hashStudentPassword(pw, salt);
    await pool.query(
      'UPDATE student_emails SET salt = $1, "passwordHash" = $2 WHERE LOWER(email) = $3',
      [salt, passwordHash, emailLower]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[学生重置密码] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.35 学生注销账户（删除注册信息/报告/绑定/邀请）
app.post('/api/student/delete-account', async (req, res) => {
  const { email, password } = req.body || {};
  const emailLower = String(email || '').toLowerCase().trim();
  const pw = String(password || '');
  if (!emailLower || !pw) return res.status(400).json({ error: '参数不完整', code: 'BAD_REQUEST' });

  try {
    const r = await pool.query('SELECT * FROM student_emails WHERE LOWER(email) = $1', [emailLower]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: '账号不存在', code: 'NOT_FOUND' });
    if (!user.passwordHash) {
      return res.status(409).json({ error: '该账号尚未设置密码，请先重置密码再注销', code: 'NEED_PASSWORD_SETUP' });
    }
    if (!verifyStudentPassword(pw, user.salt, user.passwordHash)) {
      return res.status(401).json({ error: '密码不正确', code: 'WRONG_PASSWORD' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM bindings WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM invites WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM reports WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM admin_quiz_records WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM student_emails WHERE LOWER(email) = $1', [emailLower]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[学生注销账户] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.4 学生端管理员登录（是否启用/密码由家长端管理员控制）
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '参数不完整', code: 'BAD_REQUEST' });
  if (String(username).trim().toLowerCase() !== 'administrator') {
    return res.status(401).json({ error: '管理员账号不正确', code: 'WRONG_USER' });
  }
  try {
    const r = await pool.query(
      'SELECT enabled, salt, "passwordHash", "updatedAt" FROM admin_policy WHERE id = $1',
      ['student_admin']
    );
    const row = r.rows[0];
    if (!row) return res.status(500).json({ error: '管理员策略未初始化', code: 'NO_POLICY' });
    if (!row.enabled) {
      return res.status(403).json({ error: '学生端管理员已被家长端管理员停用', code: 'ADMIN_DISABLED' });
    }
    if (!verifyStudentPassword(password, row.salt, row.passwordHash)) {
      return res.status(401).json({ error: '管理员密码不正确', code: 'WRONG_PASSWORD' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    studentAdminTokens.set(token, {
      expires: Date.now() + STUDENT_ADMIN_TTL,
      policyUpdatedAt: Number(row.updatedAt) || 0
    });
    res.json({
      success: true,
      token,
      user: { email: 'administrator@qbti.local', username: 'Administrator', phone: '', role: 'admin' },
      policy: { enabled: true, updatedAt: Number(row.updatedAt) || null }
    });
  } catch (err) {
    console.error('[学生端管理员登录] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.5 学生端管理员策略校验（停用/改密后旧会话失效）
app.get('/api/admin/policy', async (req, res) => {
  const token = studentAdminTokenFromReq(req);
  const entry = studentAdminTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    if (token) studentAdminTokens.delete(token);
    return res.status(401).json({ error: '管理员登录已过期，请重新登录', code: 'ADMIN_AUTH' });
  }
  try {
    const r = await pool.query('SELECT enabled, "updatedAt" FROM admin_policy WHERE id = $1', ['student_admin']);
    const row = r.rows[0];
    if (!row || !row.enabled) {
      studentAdminTokens.delete(token);
      return res.status(403).json({ error: '学生端管理员已被家长端管理员停用', code: 'ADMIN_DISABLED' });
    }
    if ((Number(row.updatedAt) || 0) !== entry.policyUpdatedAt) {
      studentAdminTokens.delete(token);
      return res.status(401).json({ error: '学生端管理员策略已变更，请重新登录', code: 'ADMIN_POLICY_CHANGED' });
    }
    res.json({ success: true, policy: { enabled: true, updatedAt: Number(row.updatedAt) || null } });
  } catch (err) {
    console.error('[学生端管理员策略] 校验失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 5. 家长注册
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
    const checkP = await pool.query('SELECT email FROM parents WHERE email = $1', [emailLower]);
    if (checkP.rows.length > 0) return res.status(409).json({ error: '该邮箱已注册为家长账号' });
    
    const checkS = await pool.query('SELECT email FROM student_emails WHERE email = $1', [emailLower]);
    if (checkS.rows.length > 0) return res.status(409).json({ error: '该邮箱已注册为学生账号，不能同时注册为家长' });

    const salt = genSalt();
    const passwordHash = hashPassword(password, salt);
    const createdAt = Date.now();

    await pool.query(
      `INSERT INTO parents (email, phone, username, salt, "passwordHash", "createdAt") 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [emailLower, phone, username, salt, passwordHash, createdAt]
    );

    res.json({ success: true, user: { email: emailLower, phone, username, createdAt } });
  } catch (err) {
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 6. 家长登录
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
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 7. 学生生成邀请码
app.post('/api/bind/generate', async (req, res) => {
  const { studentEmail, studentUsername } = req.body || {};
  if (!studentEmail) return res.status(400).json({ error: '缺少学生邮箱' });
  const se = String(studentEmail).trim().toLowerCase();

  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM bindings WHERE "studentEmail" = $1', [se]);
    if (parseInt(countRes.rows[0].count, 10) >= 2) {
      return res.status(409).json({ error: '已达到绑定上限（最多绑定 2 位家长）' });
    }

    await pool.query('DELETE FROM invites WHERE "studentEmail" = $1 AND used = false', [se]);

    const code = genInviteCode();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await pool.query(
      `INSERT INTO invites (code, "studentEmail", "studentUsername", "createdAt", "expiresAt", used)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [code, se, studentUsername || '', now, expiresAt]
    );

    res.json({ success: true, code, expiresAt, boundCount: parseInt(countRes.rows[0].count, 10), maxBound: 2 });
  } catch (err) {
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 8. 学生获取绑定列表
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
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 9. 学生解绑家长
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
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 10. 家长接受邀请码绑定
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
    if (parseInt(countRes.rows[0].count, 10) >= 2) return res.status(409).json({ error: '该学生已达到绑定上限' });

    const bindCheck = await pool.query('SELECT id FROM bindings WHERE "studentEmail" = $1 AND "parentEmail" = $2', [se, pe]);
    if (bindCheck.rows.length > 0) {
      await pool.query('UPDATE invites SET used = true WHERE code = $1', [c]);
      return res.status(409).json({ error: '您已绑定该学生' });
    }

    await pool.query(
      `INSERT INTO bindings ("studentEmail", "studentUsername", "parentEmail", "boundAt") 
       VALUES ($1, $2, $3, $4)`,
      [se, inv.studentUsername || '', pe, Date.now()]
    );
    await pool.query('UPDATE invites SET used = true WHERE code = $1', [c]);

    res.json({ success: true, studentEmail: se, studentUsername: inv.studentUsername || '' });
  } catch (err) {
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 11. 家长获取绑定的学生列表
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
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 12. 同步报告（学生端用）
app.post('/api/report/sync', async (req, res) => {
  const { studentEmail, studentUsername, payload } = req.body || {};
  if (!studentEmail || !payload) return res.status(400).json({ error: '参数不完整' });
  const se = String(studentEmail).trim().toLowerCase();
  const updatedAt = Date.now();
  const quizTs = Number(payload.quizTs) || updatedAt;
  payload.quizTs = quizTs;

  try {
    /* 管理员回填历史时，不要把家长端已经生成的 AI 报告覆盖掉 */
    if (se === 'administrator@qbti.local') {
      try {
        const prev = await pool.query(
          'SELECT payload FROM admin_quiz_records WHERE "studentEmail" = $1 AND "quizTs" = $2',
          [se, quizTs]
        );
        const prevPayload = prev.rows[0] && prev.rows[0].payload;
        if (prevPayload && prevPayload.aiReport && !payload.aiReport) {
          payload.aiReport = prevPayload.aiReport;
          payload.aiReportLang = prevPayload.aiReportLang;
          payload.aiReportSource = prevPayload.aiReportSource;
          payload.aiReportAt = prevPayload.aiReportAt;
        }
      } catch(e){}
    }
    await pool.query(
      `INSERT INTO reports ("studentEmail", "studentUsername", payload, "updatedAt")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("studentEmail") DO UPDATE 
       SET "studentUsername" = EXCLUDED."studentUsername",
           payload = EXCLUDED.payload,
           "updatedAt" = EXCLUDED."updatedAt"`,
      [se, studentUsername || '', JSON.stringify(payload), updatedAt]
    );
    /* 学生端管理员：每次问卷都留一条快照，供家长端管理员查看全部历史 */
    if (se === 'administrator@qbti.local') {
      await pool.query(
        `INSERT INTO admin_quiz_records ("studentEmail", "quizTs", payload, "createdAt")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("studentEmail", "quizTs") DO UPDATE
         SET payload = EXCLUDED.payload, "createdAt" = EXCLUDED."createdAt"`,
        [se, quizTs, JSON.stringify(payload), updatedAt]
      );
    }
    res.json({ success: true, updatedAt, quizTs });
  } catch (err) {
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 13. 获取报告（家长端用）
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
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

// 14. 健康检查
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    if (DATABASE_URL) {
      await pool.query('SELECT 1');
      dbOk = true;
    }
  } catch (e) {}
  res.json({ ok: true, mailer: !!AGENTMAIL_API_KEY, database: dbOk ? 'connected' : 'disconnected' });
});

// 15. 页面路由
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/parent', (req, res) => res.sendFile(path.join(__dirname, 'parent.html')));

// 启动服务：先补齐表结构，再开始接收请求
initDB().finally(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log('  QBTI 学生端服务器已启动');
    console.log('  端口: ' + PORT);
    console.log('  邮件: ' + (AGENTMAIL_API_KEY ? '✅ 已启用' : '⚠️  未配置'));
    console.log('  数据库: ' + (DATABASE_URL ? '✅ 已配置' : '❌ 未配置'));
    console.log('===========================================');
    console.log('');
  });
});