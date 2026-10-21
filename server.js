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
    `CREATE OR REPLACE FUNCTION qbti_check_binding_limit() RETURNS trigger AS $$
     BEGIN
       PERFORM pg_advisory_xact_lock(hashtext(NEW."studentEmail")::bigint);
       IF (SELECT COUNT(*) FROM bindings WHERE "studentEmail" = NEW."studentEmail") >= 2 THEN
         RAISE EXCEPTION 'STUDENT_BIND_LIMIT';
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`,
    `DROP TRIGGER IF EXISTS qbti_binding_limit ON bindings;`,
    `CREATE TRIGGER qbti_binding_limit BEFORE INSERT ON bindings
       FOR EACH ROW EXECUTE FUNCTION qbti_check_binding_limit();`,
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
    `CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(255),
      role VARCHAR(20),
      type VARCHAR(20),
      content TEXT NOT NULL,
      "userEmail" VARCHAR(255),
      page VARCHAR(50),
      app VARCHAR(20) NOT NULL DEFAULT 'student',
      ip VARCHAR(64),
      "userAgent" TEXT,
      referer TEXT,
      reply TEXT,
      "replySubject" VARCHAR(255),
      "replyAt" BIGINT,
      "replyBy" VARCHAR(255),
      "replyTo" VARCHAR(255),
      "createdAt" BIGINT NOT NULL
    );`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS app VARCHAR(20) NOT NULL DEFAULT 'student';`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ip VARCHAR(64);`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS "userAgent" TEXT;`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS referer TEXT;`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reply TEXT;`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS "replySubject" VARCHAR(255);`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS "replyAt" BIGINT;`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS "replyBy" VARCHAR(255);`,
    `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS "replyTo" VARCHAR(255);`,
    `CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback ("createdAt" DESC);`,
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
    );`,
    `CREATE TABLE IF NOT EXISTS quiz_records (
      id SERIAL PRIMARY KEY,
      "studentEmail" VARCHAR(255) NOT NULL,
      "quizTs" BIGINT NOT NULL,
      payload JSONB,
      "createdAt" BIGINT NOT NULL,
      UNIQUE("studentEmail", "quizTs")
    );`,
    `CREATE TABLE IF NOT EXISTS student_sessions (
      token VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      "createdAt" BIGINT NOT NULL,
      "expiresAt" BIGINT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_student_sessions_email ON student_sessions(email);`,
    `CREATE TABLE IF NOT EXISTS account_settings (
      "studentEmail" VARCHAR(255) PRIMARY KEY,
      settings JSONB,
      "updatedAt" BIGINT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS app_config (
      id VARCHAR(32) PRIMARY KEY,
      config JSONB,
      "updatedAt" BIGINT NOT NULL,
      "updatedBy" VARCHAR(255)
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
const feedbackCooldowns = new Map();
function studentAdminTokenFromReq(req){
  const h = String(req.headers.authorization || '');
  if(h.indexOf('Bearer ') === 0) return h.slice(7).trim();
  return String(req.headers['x-admin-token'] || '');
}

const SYNC_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

async function issueStudentSession(email){
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await pool.query(
    `INSERT INTO student_sessions (token, email, "createdAt", "expiresAt")
     VALUES ($1, $2, $3, $4)`,
    [token, String(email).toLowerCase(), now, now + SYNC_TOKEN_TTL]
  );
  try {
    await pool.query('DELETE FROM student_sessions WHERE "expiresAt" < $1', [now]);
  } catch(e){}
  return token;
}

async function resolveSyncEmail(req){
  const token = studentAdminTokenFromReq(req);
  if(!token) return null;
  const admin = studentAdminTokens.get(token);
  if(admin && admin.expires > Date.now()){
    return 'administrator@qbti.local';
  }
  try {
    const r = await pool.query(
      'SELECT email FROM student_sessions WHERE token = $1 AND "expiresAt" > $2',
      [token, Date.now()]
    );
    return r.rows[0] ? String(r.rows[0].email).toLowerCase() : null;
  } catch(e){
    return null;
  }
}

async function requireSyncAuth(req, res, next){
  const email = await resolveSyncEmail(req);
  if(!email) return res.status(401).json({ error: '登录已过期，请重新登录', code: 'SYNC_AUTH' });
  req.syncEmail = email;
  return next();
}

async function requireStudentAdmin(req, res, next){
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
      return res.status(403).json({ error: '学生端管理员已被停用', code: 'ADMIN_DISABLED' });
    }
    if ((Number(row.updatedAt) || 0) !== entry.policyUpdatedAt) {
      studentAdminTokens.delete(token);
      return res.status(401).json({ error: '管理员策略已变更，请重新登录', code: 'ADMIN_POLICY_CHANGED' });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
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

function escapeEmailHtml(text){
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendFeedbackReplyEmail(to, subject, body, feedback) {
  if (!AGENTMAIL_API_KEY) return { ok: false, error: '未配置邮件服务' };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: '收件邮箱无效' };
  const inbox = await ensureInbox();
  if (!inbox) return { ok: false, error: '邮件服务不可用' };
  const safeBody = escapeEmailHtml(body).replace(/\n/g, '<br>');
  const safeOriginal = escapeEmailHtml(String(feedback.content || '').slice(0, 600)).replace(/\n/g, '<br>');
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
          subject: '【QBTI】' + (subject || '关于你的反馈回复'),
          html: [
            '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#0B0D1C;color:#E9EBFF;border-radius:16px;">',
            '  <h2 style="color:#fff;margin-bottom:16px;">QBTI 反馈回复</h2>',
            '  <p style="color:#8B90B8;line-height:1.7;">你好，感谢你的反馈。以下是管理员给你的回复：</p>',
            '  <div style="margin:20px 0;padding:16px;border-radius:12px;background:rgba(124,92,255,.12);color:#E9EBFF;line-height:1.8;">' + safeBody + '</div>',
            '  <p style="color:#8B90B8;font-size:12px;margin-top:24px;">你提交的原始反馈：</p>',
            '  <div style="padding:12px;border-left:3px solid #5A8CF5;color:#A8AEDA;font-size:13px;line-height:1.7;">' + safeOriginal + '</div>',
            '  <p style="color:#8B90B8;font-size:12px;margin-top:24px;">如需继续沟通，请联系：1182332400@qq.com</p>',
            '</div>'
          ].join('\n')
        })
      }
    );
    if (!sendRes.ok) {
      const t = await sendRes.text().catch(() => '');
      console.error('[AgentMail] 反馈回复发送失败:', sendRes.status, t.slice(0, 200));
      return { ok: false, error: '邮件发送失败' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[AgentMail] 反馈回复异常:', err.message);
    return { ok: false, error: '邮件发送异常' };
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

    const syncToken = await issueStudentSession(emailLower);
    res.json({
      success: true,
      syncToken: syncToken,
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

    const syncToken = await issueStudentSession(user.email);
    res.json({
      success: true,
      syncToken: syncToken,
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
      await client.query('DELETE FROM quiz_records WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM account_settings WHERE "studentEmail" = $1', [emailLower]);
      await client.query('DELETE FROM student_sessions WHERE LOWER(email) = $1', [emailLower]);
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
      syncToken: token,
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

// 4.6 投诉与反馈（所有人可提交）
app.post('/api/feedback', async (req, res) => {
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || 'unknown').trim();
  const now = Date.now();
  const last = feedbackCooldowns.get(ip) || 0;
  if (now - last < 15 * 1000) {
    return res.status(429).json({ error: '提交太频繁，请稍后再试', code: 'RATE_LIMIT' });
  }

  const body = req.body || {};
  const type = ['suggestion', 'complaint', 'other'].includes(body.type) ? body.type : 'suggestion';
  const content = String(body.content || '').trim();
  if (content.length < 5 || content.length > 2000) {
    return res.status(400).json({ error: '反馈内容需要 5-2000 字', code: 'BAD_CONTENT' });
  }
  const name = String(body.name || '').trim().slice(0, 50);
  const email = String(body.email || '').trim().slice(0, 255);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '请填写正确的联系邮箱', code: 'BAD_EMAIL' });
  }
  const role = ['student', 'parent', 'admin', 'guest'].includes(body.role) ? body.role : 'guest';
  const userEmail = String(body.userEmail || '').trim().toLowerCase().slice(0, 255);
  const page = String(body.page || 'contact').trim().slice(0, 50);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
  const referer = String(req.headers.referer || req.headers.origin || '').slice(0, 500);

  try {
    const r = await pool.query(
      `INSERT INTO feedback (name, email, role, type, content, "userEmail", page, app, ip, "userAgent", referer, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'student', $8, $9, $10, $11)
       RETURNING id, "createdAt"`,
      [name, email, role, type, content, userEmail, page, ip, userAgent, referer, now]
    );
    feedbackCooldowns.set(ip, now);
    if (feedbackCooldowns.size > 2000) {
      const cutoff = now - 5 * 60 * 1000;
      for (const [k, v] of feedbackCooldowns) {
        if (v < cutoff) feedbackCooldowns.delete(k);
      }
    }
    res.json({ success: true, id: r.rows[0].id, createdAt: Number(r.rows[0].createdAt) });
  } catch (err) {
    console.error('[反馈] 保存失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.7 学生端管理员查看所有投诉与反馈
app.get('/api/admin/feedback', requireStudentAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, name, email, role, type, content, "userEmail", page, "createdAt",
             app, ip, "userAgent", referer, reply, "replySubject", "replyAt", "replyBy", "replyTo"
      FROM feedback
      WHERE app = 'student'
      ORDER BY "createdAt" DESC
      LIMIT 500
    `);
    const list = r.rows.map(row => Object.assign({}, row, { createdAt: Number(row.createdAt) || 0, replyAt: row.replyAt ? Number(row.replyAt) : null }));
    res.json({ success: true, list: list, count: list.length });
  } catch (err) {
    console.error('[反馈] 管理员读取失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.8 学生端管理员邮件回复反馈
app.post('/api/admin/feedback/:id/reply', requireStudentAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: '反馈 ID 不正确' });
  const subject = String((req.body && req.body.subject) || '').trim().slice(0, 120) || '关于你的反馈回复';
  const body = String((req.body && req.body.body) || '').trim();
  if (body.length < 1 || body.length > 5000) {
    return res.status(400).json({ error: '回复内容需要 1-5000 字' });
  }
  try {
    const r = await pool.query(
      `SELECT id, name, email, content, "userEmail" FROM feedback WHERE id = $1 AND app = 'student'`,
      [id]
    );
    const fb = r.rows[0];
    if (!fb) return res.status(404).json({ error: '反馈不存在' });
    const to = String(fb.email || fb.userEmail || '').trim();
    if (!to) return res.status(400).json({ error: '该反馈没有可回复的邮箱' });

    const sent = await sendFeedbackReplyEmail(to, subject, body, fb);
    if (!sent.ok) return res.status(502).json({ error: sent.error || '邮件发送失败', code: 'MAIL_FAILED' });

    const now = Date.now();
    await pool.query(
      `UPDATE feedback
       SET reply = $1, "replySubject" = $2, "replyAt" = $3, "replyBy" = $4, "replyTo" = $5
       WHERE id = $6`,
      [body, subject, now, 'Administrator', to, id]
    );
    res.json({ success: true, replyAt: now, replyTo: to });
  } catch (err) {
    console.error('[反馈回复] 失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

/* ============================================================
   四维星云对话：服务端提供用户专属提示词，前端每次调用 AI 生成全新剧本
   每个维度使用完全不同的场景，禁止全部写成“开门”
   ============================================================ */
const DIALOGUE_BLUEPRINTS = {
  PO: {
    name: '潜能开放度',
    scene: '一座废弃的天文台，观测室尽头有一扇很久没有打开的门，屋顶的星图已经褪色',
    link: '观测室墙上那台还在闪的旧射电接收器',
    background: '这座天文台已经废弃十年以上，屋顶的星图褪色，墙角堆着掉落的铆钉，旧射电接收器还在待机，空气里全是灰',
    metaphor: '门后可能是新的观测数据，也可能什么都没有',
    forbidden: '可以出现天文台的观测门，但不要出现避难所、末日、怪物、列车、图书馆、灯塔',
    logic: '星图裂缝不能突然出现：先写屋顶旧支架的吱呀声、灰尘落下、温度变化或风吹动接缝，让用户先感觉到“要出事”。',
    causal: { setup: '屋顶西北角的旧铆钉已经松了很久，风大时会响；星图接缝处的锈迹一直在往下掉灰。', trigger: '风压升高，旧支架带着接缝一起变形，裂缝才慢慢扩大，星光从缝里漏下来。', payoff: '最后那点光不是奇迹，它一直来自那道被忽视的裂缝。' },
    common: ['你站在废弃天文台的观测室里…', '控制台还亮着一点点光…', '观测室尽头…是一扇很久没有打开的门…'],
    states: {
      danger: ['——哔…', '我正在扫描你的潜能状态…', 'Error 404 No Found…', '信号很弱…像一条没有目的地的航线…', '你不是没有能力…', '只是很久没有问过自己…想去哪里了…'],
      good: ['——哔…', '我正在扫描你的潜能状态…', '信号已锁定…', '有一束很细的光…从你的方向穿过来…', '它不吵…也没有急着证明什么…'],
      superposition: ['——哔…', '我正在扫描你的潜能状态…', '信号在两个频段之间…', '一边是熟悉的控制台…', '一边是那扇没有打开的门…']
    },
    acts: [
      {
        prompt: '观测室的门就在前面…门后可能是新的星图，也可能什么都没有…你会怎么做…？',
        options: [
          { text: '留在控制台，先检查旧数据', feedback: ['你更愿意先握住已经有的东西…', '这让你感到安全…'] },
          { text: '把门打开一条缝，先听一听', feedback: ['你在用自己的速度…试探门外…', '这条缝…不大，也不小…'] },
          { text: '直接推开门，走进去', feedback: ['你不想再隔着门猜了…', '哪怕里面什么都没有…'] }
        ]
      },
      {
        prompt: '门后传来一阵很轻的电流声…像旧设备重新启动…你会怎么做…？',
        options: [
          { text: '关掉控制台，让声音停下', feedback: ['你让房间重新安静下来…', '安静…有时比答案更容易让人呼吸…'] },
          { text: '停在门边，继续听', feedback: ['你没有进去，也没有离开…', '你把自己放在一个可以随时后退的位置…'] },
          { text: '循着声音走进去', feedback: ['你选择让身体先于答案行动…', '脚步…比想象中轻…'] }
        ]
      },
      {
        prompt: '屋顶传来金属疲劳的吱呀声…星图接缝处落下细灰…裂缝在慢慢变宽…真正的星光漏了下来…你会怎么做…？',
        options: [
          { text: '回到控制台后面', feedback: ['你退回了熟悉的光里…', '这不代表你没有看见那片星空…'] },
          { text: '走到望远镜前', feedback: ['你靠近了那台很久没用的望远镜…', '镜筒里…有一点微光…'] },
          { text: '站在门口，抬头看', feedback: ['你站在门与星光之间…', '没有急着选择…'] }
        ]
      }
    ],
    branches: {
      A: ['你留在了控制台前…', '电流声慢慢低了下去…', '房间恢复了原来的安静…', '可你总觉得自己听见了什么…'],
      B: ['你没有走远…', '门缝里的风停了…', '那道声音也消失了…', '你站在原地…很久没有动…'],
      C: ['你走进观测室深处…', '里面没有怪物…', '只有一台还在缓慢转动的旧望远镜…', '镜筒对着的地方…有一颗很暗的星…']
    },
    final: {
      lines: ['我记下了…', '其实那扇门后面的东西…', '也许就是那些让你觉得麻烦的新可能…', '最后一个问题…', '你怕的是门后什么都没有…', '还是怕自己看不懂…？'],
      prompt: '你更接近哪一种…？',
      options: [
        { text: '怕门后什么都没有', feedback: ['空…确实很容易让人退回去…', '但空也意味着…还没有被写死…'] },
        { text: '怕自己看不懂', feedback: ['能看见这一层…已经很不容易了…', '看不懂…不等于永远看不懂…'] },
        { text: '没想过，留在控制台挺好', feedback: ['没想过也没关系…', '控制台的光…也是真实的…'] },
        { text: '但推开门的时候，感觉还不赖', feedback: ['你记住了推开门的那一下…', '那一秒…你是自由的…'] }
      ]
    }
  },
  II: {
    name: '内在驱动力',
    scene: '一列停在环形轨道上的老式列车，锅炉已经冷了，车头还亮着一盏昏黄的小灯',
    link: '列车驾驶室里的旧广播和压力表',
    background: '这条环形轨道属于废弃矿区，列车锅炉改装过，车厢里积着煤灰，驾驶室广播接触不良，隧道墙上有旧检修字',
    metaphor: '要不要重新点燃锅炉，还是继续留在车厢里',
    forbidden: '禁止出现门、避难所、铁门、开门、末日、天文台、图书馆、灯塔等意象',
    logic: '锅炉、压力表、隧道墙上的字都要有来源：旧煤灰、冷却收缩、前乘客留下的痕迹；不能凭空出现。',
    causal: { setup: '锅炉冷却后油管收缩，压力表卡在红区，车头灯因为接触不良一闪一闪。', trigger: '点火让压力骤升，刹车管路渗漏，列车才自己滑出去。', payoff: '隧道墙上的旧字是上一任司机留下的，和这次选择形成对照。' },
    common: ['你在一列停在环形轨道上的旧列车里…', '锅炉已经冷了…', '车头还亮着一盏昏黄的小灯…', '窗外是没有尽头的轨道…'],
    states: {
      danger: ['——哔…', '我正在扫描你的驱动状态…', 'Error 404 No Found…', '锅炉没有压力…', '不是这列车坏了…', '是你已经很久没有找到…想去的站台了…'],
      good: ['——哔…', '我正在扫描你的驱动状态…', '压力表在缓慢上升…', '车头的小灯…一直亮着…'],
      superposition: ['——哔…', '我正在扫描你的驱动状态…', '仪表在两个刻度之间…', '一会儿靠近“出发”…', '一会儿靠近“再等等”…']
    },
    acts: [
      {
        prompt: '锅炉里还剩一点燃料…车头的小灯在闪…你会怎么做…？',
        options: [
          { text: '留在车厢里，等它自己热起来', feedback: ['你选择先不碰锅炉…', '等待…也是一种动作…'] },
          { text: '试着点火，看看能不能启动', feedback: ['你把手伸向点火器…', '没有把握…但也没有完全放弃…'] },
          { text: '把剩下的燃料全部倒进去', feedback: ['你不想再一点点试了…', '你要么不走…要么就走得彻底…'] }
        ]
      },
      {
        prompt: '轨道在前方分成两条…一条回环，一条通向隧道…你会怎么选…？',
        options: [
          { text: '拉下手刹，停在分岔口', feedback: ['你让列车停了下来…', '分岔口的风…从两边吹过来…'] },
          { text: '下车，先看看轨道通向哪里', feedback: ['你离开了车厢…', '脚踩在碎石上…声音很轻…'] },
          { text: '把速度推到底，冲进隧道', feedback: ['你没有给自己留太多犹豫…', '隧道的黑暗…一下子吞掉了车灯…'] }
        ]
      },
      {
        prompt: '车头灯扫过隧道墙…煤灰下面露出一行旧字…像是很多年前留下的…你会怎么做…？',
        options: [
          { text: '回到座位，不再看', feedback: ['你移开了视线…', '有些字…不看也可以继续开…'] },
          { text: '继续添燃料，让灯更亮', feedback: ['你往锅炉里又添了一点…', '灯亮了一些…墙上的字也更清楚了…'] },
          { text: '站到车头，迎着风', feedback: ['你站到了最前面…', '风很大…但你看得很远…'] }
        ]
      }
    ],
    branches: {
      A: ['你留在了车厢里…', '锅炉慢慢冷却…', '小灯还在闪…', '轨道一直延伸到看不见的地方…'],
      B: ['你走下轨道…', '发现前面并没有终点站…', '只有一段又一段…需要自己接上的铁轨…'],
      C: ['列车冲出隧道…', '外面不是站台…', '是一片没有名字的旷野…', '小灯照着前方…路要自己铺…']
    },
    final: {
      lines: ['我记下了…', '这列车…', '也许一直在等你决定去哪里…', '最后一个问题…', '你是一直在等车修好…', '还是害怕下车之后…发现自己其实没有目的地…？'],
      prompt: '你更接近哪一种…？',
      options: [
        { text: '等车修好再说', feedback: ['等…也是一种真实的状态…', '车可以慢慢修…'] },
        { text: '怕自己没有目的地', feedback: ['能承认这一点…已经很难了…', '目的地…有时是走着走着才出现的…'] },
        { text: '没想过，坐着也挺好', feedback: ['没想过也没关系…', '车厢里的灯…也曾经照亮过你…'] },
        { text: '但刚刚冲进隧道的时候，感觉还不赖', feedback: ['你记住了那阵风…', '有一瞬间…你是往前走的…'] }
      ]
    }
  },
  LA: {
    name: '学习自主性',
    scene: '一间会在无人时自动改写书页的图书馆，桌上摊着一张只有你能看见的地图',
    link: '图书馆借阅台上的绿色终端和台灯',
    background: '图书馆闭馆多年，借阅终端还能亮，书架底部的旧轨道老化，空气潮湿，地图是上一位读者留下的',
    metaphor: '跟着别人写好的路线，还是自己画一条',
    forbidden: '禁止出现门、避难所、铁门、开门、列车、锅炉、天文台、灯塔等意象',
    logic: '书架移动要有旧轨道、机关或风的原因；书页自动改写要有潮气、风或提前留下的字迹；地图不能凭空出现。',
    causal: { setup: '地板下的旧轨道早就松了，潮气让书页粘在一起，地图边缘有上一位读者留下的铅笔印。', trigger: '风从闭馆的窗缝灌进来，旧轨道滑动，书架才让开；书页自翻是因为潮气和风。', payoff: '地图上的线不是凭空出现的，是上一位读者画的，用户要决定跟不跟。' },
    common: ['你在一间很安静的图书馆里…', '桌上的书会自己翻页…', '摊开的地图上…只有你能看见的线…', '书架深处…传来很轻的纸页声…'],
    states: {
      danger: ['——哔…', '我正在扫描你的学习自主状态…', 'Error 404 No Found…', '地图上没有主线…', '不是你没有路…', '是每一条路…都像是别人替你画的…'],
      good: ['——哔…', '我正在扫描你的学习自主状态…', '地图上有一条很细的线…', '它不宽…但一直连向前面…'],
      superposition: ['——哔…', '我正在扫描你的学习自主状态…', '地图上的线…一会儿出现…', '一会儿又隐进纸里…']
    },
    acts: [
      {
        prompt: '书页上出现了你的名字…旁边是一条被标好的路线…你会怎么做…？',
        options: [
          { text: '合上书，先不看', feedback: ['你把手从书页上移开…', '有些答案…不一定要现在读…'] },
          { text: '用铅笔在旁边改一条路', feedback: ['你在那条线旁边…画了一道很轻的痕…', '它不大…但确实是你画的…'] },
          { text: '把地图撕下来带走', feedback: ['你把地图折好…放进口袋…', '纸很薄…却有一点重量…'] }
        ]
      },
      {
        prompt: '地板下传来旧轨道滚动的声音…书架慢慢移开…露出一条没有标注的走廊…你会怎么做…？',
        options: [
          { text: '留在原地，继续看书', feedback: ['你留在了灯下…', '走廊里的风…从书页间穿过去…'] },
          { text: '跟着地图上的线走进去', feedback: ['你沿着那条线…走进书架深处…', '纸页的声音…越来越近…'] },
          { text: '自己画一条新的线', feedback: ['你没有跟着现成的路…', '笔尖在纸上…停了一下…'] }
        ]
      },
      {
        prompt: '闭馆的灯开始一盏盏熄灭…桌上只剩一张空白书页…你会怎么做…？',
        options: [
          { text: '把书放回原位', feedback: ['你把书合上…放回书架…', '有些东西…留在原处也很好…'] },
          { text: '借着最后一盏灯，继续读', feedback: ['你没有走…', '灯光很小…但足够照亮一行字…'] },
          { text: '把空白书页带走', feedback: ['你把那页空白…夹进了自己的书里…', '它还没有被写…'] }
        ]
      }
    ],
    branches: {
      A: ['你留在了灯下…', '书页慢慢停了…', '地图上的线…也淡了下去…', '可你记住了那一行字…'],
      B: ['你沿着地图走进深处…', '走廊尽头不是出口…', '是一张更大的桌子…', '桌上放着另一张空白地图…'],
      C: ['你带走了空白书页…', '图书馆的灯在身后熄灭…', '纸页很轻…', '但你知道…它还没有写完…']
    },
    final: {
      lines: ['我记下了…', '地图上的线…', '也许不是答案…', '最后一个问题…', '你是在找一条自己的路…', '还是在等一本书…替你写答案…？'],
      prompt: '你更接近哪一种…？',
      options: [
        { text: '想找一条自己的路', feedback: ['你没有把地图当成终点…', '路…还在你脚下…'] },
        { text: '希望有人告诉我答案', feedback: ['想有人告诉…也很正常…', '但答案…有时会以问题的样子出现…'] },
        { text: '没想过，先看书就好', feedback: ['先看书也很好…', '不是每一页…都要立刻翻过去…'] },
        { text: '但自己画线的时候，感觉还不赖', feedback: ['你记住了下笔的那一下…', '那一笔…是你的…'] }
      ]
    }
  },
  UR: {
    name: '未知应对方式',
    scene: '夜里的海面，灯塔的灯已经灭了，雾里传来没有来源的声音',
    link: '灯塔底层的无线电和雾笛',
    background: '灯塔已经停用，无线电靠一台旧发电机，雾笛电压不稳，油表见底，退潮时暗礁会露出一点黑边',
    metaphor: '要不要点亮灯塔，还是留在岸边等雾散',
    forbidden: '禁止出现门、避难所、铁门、开门、列车、锅炉、图书馆、地图、天文台等意象',
    logic: '船影、声音、灯油告急都要有潮汐、浮标、旧机械、风向的前兆；不能突然冒出来。',
    causal: { setup: '潮汐转向，浮标钢索发出低频的摩擦声，灯塔的油表早就见底。', trigger: '雾变浓后，失控的旧渔船被潮水推近，才出现船影；不是怪物。', payoff: '灯只能亮一次，用户的选择决定这束光留给谁。' },
    common: ['你在夜里的海边…', '灯塔的灯已经灭了…', '雾很厚…', '海面深处…传来一阵没有来源的声音…'],
    states: {
      danger: ['——哔…', '我正在扫描你的未知应对状态…', 'Error 404 No Found…', '雾太厚了…', '看不见岸线…', '也看不见灯塔到底还在不在…'],
      good: ['——哔…', '我正在扫描你的未知应对状态…', '雾里有一点光…', '很弱…但没有灭…'],
      superposition: ['——哔…', '我正在扫描你的未知应对状态…', '灯塔一会儿亮…', '一会儿又暗下去…', '像在两个答案之间…']
    },
    acts: [
      {
        prompt: '灯塔的开关就在手边…海里的声音又响了一下…你会怎么做…？',
        options: [
          { text: '守在岸边，等雾散', feedback: ['你选择先留在岸上…', '雾没有散…但也没有更浓…'] },
          { text: '摸着墙，慢慢靠近灯塔', feedback: ['你沿着潮湿的墙…一步一步走…', '声音…越来越近…'] },
          { text: '点亮灯塔', feedback: ['你按下了开关…', '整片雾…突然有了形状…'] }
        ]
      },
      {
        prompt: '雾里的潮声忽然变了…一个模糊的船影慢慢显出来…它没有靠近，也没有离开…你会怎么做…？',
        options: [
          { text: '回到屋里，拉上窗帘', feedback: ['你回到了屋里…', '海的声音…被隔在窗外…'] },
          { text: '站在原地，继续听', feedback: ['你没有动…', '船影也没有动…', '你们隔着一层雾…互相看着…'] },
          { text: '向船影走去', feedback: ['你朝海面走了几步…', '水没过脚踝…很冷…'] }
        ]
      },
      {
        prompt: '灯油快尽了…天亮之前，灯塔只能再亮一次…你会怎么做…？',
        options: [
          { text: '把灯留给后来的人', feedback: ['你把最后一点灯油…留在了灯里…', '也许有人…会看见…'] },
          { text: '熄灯，保存最后一点油', feedback: ['你熄灭了灯…', '黑暗重新合拢…', '但你还在…'] },
          { text: '把灯转向海面', feedback: ['你把灯转向了最黑的地方…', '光柱切开雾…'] }
        ]
      }
    ],
    branches: {
      A: ['你留在了岸边…', '雾一直没有散…', '海的声音也一直没停…', '但你没有再往后退…'],
      B: ['你停在了水边…', '船影慢慢淡了…', '天亮的时候…海面只剩下你的脚印…'],
      C: ['你走进了雾里…', '没有怪物…', '只有一座没有人看守的灯塔…', '灯还亮着…']
    },
    final: {
      lines: ['我记下了…', '海里的声音…', '也许只是风…', '最后一个问题…', '你怕的是海里的东西…', '还是怕灯亮之后…看见自己站在哪里…？'],
      prompt: '你更接近哪一种…？',
      options: [
        { text: '怕海里的东西', feedback: ['怕…并不丢人…', '海本来就不小…'] },
        { text: '怕灯亮之后，看见自己', feedback: ['看见自己…有时比看见怪物更难…', '但你已经站在这里了…'] },
        { text: '没想过，留在岸上挺好', feedback: ['留在岸上…也是一种位置…', '不是每个人都要出海…'] },
        { text: '但灯亮起来的时候，感觉还不赖', feedback: ['你记住了灯亮的那一下…', '那一秒…雾退开了一点…'] }
      ]
    }
  }
};

const DIALOGUE_VARIANTS = {
  PO: [
    { setup: '屋顶西北角的旧铆钉已经松了很久，风大时会响；星图接缝处的锈迹一直在往下掉灰', trigger: '夜里的风压升高，旧支架带着接缝一起变形，裂缝才慢慢扩大，星光从缝里漏下来', payoff: '最后那点光不是奇迹，它一直来自那道被忽视的裂缝' },
    { setup: '观测室夜里降温很快，星图金属接缝和屋顶支架收缩的速度不一样，白天就能看见一道很细的旧痕', trigger: '温度继续下降，接缝被拉开，积在夹层里的灰先落下来，然后才是星光', payoff: '用户最后发现，裂缝不是今晚才有，只是今晚才被看见' },
    { setup: '一只鸟在星图通风口做了窝，风道被堵住，屋顶夹层的压力一直在慢慢升高，支架偶尔发出闷响', trigger: '通风口被彻底堵死，夹层压力顶开最薄的一片接缝，灰和星光一起落下来', payoff: '那点光其实来自被堵住的通风口，不是星图自己裂了' }
  ],
  II: [
    { setup: '锅炉冷却后油管收缩，压力表卡在红区，车头灯因为接触不良一闪一闪', trigger: '点火让压力骤升，刹车管路渗漏，列车才自己滑出去', payoff: '隧道墙上的旧字是上一任司机留下的，和这次选择形成对照' },
    { setup: '制动气缸里一直有轻微的漏气声，压力表针在红区边缘抖，车头灯随着气压变化忽明忽暗', trigger: '点火后气压升高，老化的制动软管爆开，列车失去刹车才滑行', payoff: '墙上的旧字是上一次事故后留下的检修标记，不是随便出现的' },
    { setup: '车钩连接处的金属已经疲劳，冷却时发出很轻的咔哒声，煤灰下面盖着一道旧裂纹', trigger: '列车启动时的震动让裂纹扩展，车钩错位，车厢才被带着滑出去', payoff: '最后那声咔哒不是怪物，是车钩终于撑不住了' }
  ],
  LA: [
    { setup: '地板下的旧轨道早就松了，潮气让书页粘在一起，地图边缘有上一位读者留下的铅笔印', trigger: '风从闭馆的窗缝灌进来，旧轨道滑动，书架才让开；书页自翻是因为潮气和风', payoff: '地图上的线不是凭空出现的，是上一位读者画的，用户要决定跟不跟' },
    { setup: '图书馆的闭馆机关年久失修，齿轮卡在半途，书架底部一直有细小的摩擦声，书页因为潮湿粘成一块', trigger: '机关在整点突然松脱，书架沿着旧轨道滑开；风把粘住的某页吹翻，露出背面的字', payoff: '那行字是上一位读者留下的借阅记录，不是预言' },
    { setup: '屋顶漏水，水滴在书脊上，几张地图因为受潮粘在一起，桌脚压着一截断掉的铅笔', trigger: '水滴穿最后一层纸，地图背面透出旧线；书架被水泡软的地板带得歪了一下，露出后面的空间', payoff: '地图上的线是水渍和旧铅笔叠出来的，用户要自己判断哪条是真的' }
  ],
  UR: [
    { setup: '潮汐转向，浮标钢索发出低频的摩擦声，灯塔的油表早就见底', trigger: '雾变浓后，失控的旧渔船被潮水推近，才出现船影；不是怪物', payoff: '灯只能亮一次，用户的选择决定这束光留给谁' },
    { setup: '灯塔的旧发电机一直有断续的敲击声，油管接头渗油，海面雾笛因为电压不稳偶尔自己响', trigger: '电压突然升高，雾笛长鸣，旧渔船的轮廓被声音和潮水一起推近', payoff: '那声音不是求救，是雾笛和钢索在风里共振' },
    { setup: '海面下有一片暗礁，退潮时水流会绕着礁石发出空洞的回声，灯塔的备用灯油只剩一个底', trigger: '潮水退到最低，暗礁露出一点黑边，回声变响，远处旧船的灯才显出来', payoff: '所谓的船影，一半是旧船，一半是暗礁在水里的倒影' }
  ]
};

const DIALOGUE_LANG_NAMES = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  ko: '한국어',
  ja: '日本語',
  fr: 'Français'
};

function dialogueSafeText(value, max){
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').slice(0, max || 120);
}

function buildDialoguePrompt(dimension, address, context, nonce, lang){
  const b = DIALOGUE_BLUEPRINTS[dimension];
  if(!b) return null;
  const c = context || {};
  const stateText = c.dimensionState === 'danger' ? '危险/未坍缩' : c.dimensionState === 'good' ? '良好/方向清晰' : '叠加/方向未定';
  const ratios = c.ratios && typeof c.ratios === 'object'
    ? Object.keys(c.ratios).slice(0, 6).map(k => dialogueSafeText(k, 8) + '=' + (Number(c.ratios[k]) || 0) + '%').join(' / ')
    : '';
  const addressText = dialogueSafeText(address, 20) || '你';
  const openingAngles = [
    '从一句没头没尾的吐槽切入',
    '从一个坏掉的提示音切入',
    '从一股不该出现的气味切入',
    '从一个很小的、没人在意的动作切入',
    '从环境里一个不对劲的细节切入'
  ];
  const systemMoods = [
    '系统有点困',
    '系统有点慌',
    '系统嘴硬',
    '系统刚被打脸',
    '系统在强装镇定'
  ];
  const openingAngle = openingAngles[Math.floor(Math.random() * openingAngles.length)];
  const systemMood = systemMoods[Math.floor(Math.random() * systemMoods.length)];
  const errorCodes = [
    'Error 404 No Found',
    'Error 403 Signal Lost',
    'Error 500 Radar Overheat',
    'Error 0x1F 信号漂移',
    'Error 418 雷达不在服务区',
    'Error 502 维度回波中断'
  ];
  const errorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
  const variantList = DIALOGUE_VARIANTS[dimension] || [b.causal];
  const variant = variantList[Math.floor(Math.random() * variantList.length)];
  return [
    '你是 QBTI 的量子态系统，第一人称是“我”，用户是“你”。',
    '【输出语言】必须全程使用 ' + (DIALOGUE_LANG_NAMES[lang] || '简体中文') + '。intro、bridge、background、选项、反馈、终幕全部使用该语言；JSON 的字段名保持英文。',
    '你正在和用户进行一场沉浸式维度对话。',
    '【本维度剧本设定】',
    '维度：' + b.name,
    '场景：' + b.scene,
    '雷达信号接入点：' + b.link,
    '本维度背景信息：' + b.background,
    '核心隐喻：' + b.metaphor,
    '禁止：' + b.forbidden,
    '因果铺垫：' + b.logic,
    '【本维度因果骨架，必须遵守】',
    '前兆：' + variant.setup,
    '触发：' + variant.trigger,
    '回收：' + variant.payoff,
    '本次只使用这一条因果变体，不得换成别的起因',
    '这份剧本只能属于这个维度，不能复用其它维度的场景，不能把所有维度都写成“开门”。',
    '本次生成编号：' + dialogueSafeText(nonce, 48),
    '本次开场角度：' + openingAngle,
    '本次系统状态：' + systemMood,
    '本次错误码：' + errorCode,
    '这是全新的一次生成：不得复用上一份剧本的开头、句式、选项、反馈或比喻；这次必须换一个开场细节和第一个动作。',
    '',
    '【开场强制：每次都要有雷达扫描】',
    '前 2-4 句必须是系统第一人称“我”在探测用户的该维度雷达，必须满足：',
    '- 出现 “Error” 字样和本次错误码（可以微调数字/文案，但必须是 Error 开头）',
    '- 出现“扫描 / 探测 / 雷达”中的至少一个词',
    '- 用“我”作为探测主体',
    '- 雷达状态要对应维度状态：危险态偏信号丢失/404，良好态偏信号锁定，叠加态偏双频/漂移',
    '- 错误码和开场现象每次必须有新意，不能固定写 Error 404',
    '- 这个雷达异常不能只是装饰：它要成为第一幕第一个前兆的原因或伏笔',
    '- 必须明确读出用户当前状态：危险态是信号断续/丢失，良好态是信号稳定/锁定，叠加态是双频/漂移',
    '',
    '【引入节奏：模仿这段呼吸，不要直接切场景】',
    'intro 必须按这个顺序写 8-10 句：',
    '1. “——哔…”',
    '2. “我正在扫描你的' + b.name + '雷达…”',
    '3. 本次 Error 错误码（可以带一句很短的系统反应）',
    '4. 对雷达状态的观察：对应危险/良好/叠加，不要只报错，要像真在读数',
    '5. 一句不评判的安抚：类似“不过别担心…还能争…”（不要保证结果，不要灌鸡汤）',
    '6. 一句理解：类似“我理解你为何会是这种状态…”',
    '7. 一句现实共鸣：类似“在现实中…每天迎接那么多未知变量…是个人都会累的…”',
    '8. “那么现在…”',
    '9. “把中控台关机…放空你的大脑…跟随着文字的指引…”',
    '10. “想象一下…”',
    '这 10 句必须原样或近似出现“放空你的大脑”“跟随着文字的指引”“想象一下”这三个关键动作，不能省略',
    '',
    '【雷达 → 剧本的衔接】',
    '- 不要报完 Error 就直接切到场景',
    '- 先让“我”读出雷达检测到的用户状态',
    '- 如果 intro 以“想象一下…”自然进入场景，就不需要强行写技术 bridge；此时 bridge 必须是空数组 []',
    '- 如果不用想象式过渡，才写 1-3 句 bridge，把异常信号接入/投影到：' + b.link,
    '- 无论用哪种方式，都必须写 background 2-4 句，交代这个地点是什么、为什么废弃/停用、现在有什么具体细节',
    '- background 至少包含本维度背景信息里的两个具体细节，不要只写“你来到一个地方”',
    '',
    '【标点】',
    '- 每个数组元素只写一句话，句末不要加“。”；需要停顿用“…”或直接结束',
    '- 选项、反馈、旁白都不要用句号收尾',
    '',
    '【用户信息】',
    '用户选择的主页问卷结果：' + dialogueSafeText(c.code, 40) + (c.typeName ? '（' + dialogueSafeText(c.typeName, 60) + '）' : ''),
    '当前维度状态：' + stateText,
    '整体状态：' + (c.quantumState === 'danger' ? '危险量子态，主线目标与方向不清晰' : '非危险态'),
    ratios ? '该维度内部占比：' + ratios : '',
    c.lead ? '当前主导子维度：' + dialogueSafeText(c.lead, 8) + (c.gap != null ? '，差值 ' + (Number(c.gap) || 0) + '%' : '') : '',
    '系统对用户的称呼：“' + addressText + '”。若称呼是“你”，直接使用“你”。',
    '',
    '【不可违反的红线】',
    '- 不要定义用户是什么样的人，不要贴人格标签，不要下诊断。',
    '- 不要说“你应该”“你必须”“你需要”“建议你”“你要相信自己”这类话。',
    '- 不要给答案、不要替用户做决定、不要评价选择的好坏。',
    '- 只描述场景、呈现选择、用开放问题让用户自己看见。',
    '- 危险量子态多写引导性问题，少下结论。',
    '- 不要出现家长、父母、老师、AI、模型、分数、评估、报告。',
    '',
    '【核心原则：尊重用户】',
    '- 不爆粗口、不嘲讽、不贬低、不贴标签、不诊断、不评价用户的选择。',
    '- 幽默来自系统自己的手忙脚乱、设备的毛病、情境的荒诞，不要来自嘲笑用户。',
    '- 可以口语、有网感、会自嘲、会慌、会嘴硬、会被打脸，但始终把用户当成队友。',
    '- 不要把选项写成“怂”“莽”“摆烂”这种人格局限标签；描述行为，不评价人格。',
    '- 不替用户做决定，不说“你应该”“你必须”“你需要”“建议你”。',
    '',
    '【写作风格：有趣，但不油、不说教】',
    '- 像真的在跟用户说话，可以有情绪、停顿、改口、半句话。',
    '- 不要每句都升华、不要每段都共情、不要连续排比，也不要把每句话都写成金句。',
    '- 可以用“不是哥们”“绷不住了”“啊？”“什么鬼”“这破设备”这类网感表达，但不要每句都堆梗。',
    '- 系统可以吐槽设备、吐槽自己、吐槽这个鬼地方，但不要吐槽用户。',
    '- 例子（只参考语感，不要照抄）：',
    '  “……行吧，这雷达又开始抽风了”',
    '  “兄弟，我先说好，这次真不是你的问题，是设备太旧”',
    '  “等一下，我把刚才的数据倒回去看一眼”',
    '  “你可以选，也可以先不选，反正我这边还没断电”',
    '  “不是哥们，这信号怎么比我还紧张”',
    '- 金句最多一两句，其余部分要留白、要像活人说话。',
    '',
    '【逻辑自洽：任何事件发生之前必须有铺垫】',
    '- 不允许“突然裂开”“突然出现声音”“突然出现船影”“突然多出一行字”。',
    '- 每个异常现象都要在前文露出原因或前兆：旧支架松动、温度变化、煤灰、潮汐、风、旧轨道、前一个选择造成的后果。',
    '- 例：先写环境的旧伤、异常声音、气味或温度变化，再让事件发生；读者要知道“这不是凭空来的”。',
    '- 前因后果要连成一条线：第一幕埋下的东西，第二幕要响；第二幕的选择，第三幕要承担后果。',
    '- 分支不能跳脱：不同选择必须导致不同的、但都说得通的后续。',
    '- 终幕问题必须由前面的经历自然长出来，不能突然开始讲人生道理。',
    '- 输出前自检：删掉所有没有铺垫的突发事件，补上至少一个可回看的前兆。',
    '',
    '【完整性要求】',
    '- 必须输出 continuity（开场细节、因果链、回收）和 background（地点背景），不能省略；bridge 可以为空数组。',
    '- intro 8-10 句，必须包含雷达、Error、状态观察、安抚、理解、现实共鸣、放空大脑、想象；act1/act2/act3 每幕 3 个选项，final 4 个选项。',
    '- 每个选项的 feedback 必须有 1-2 句，不能空。',
    '- branches 必须同时包含 A/B/C 三条，每条 2-4 句，不能只写一条。',
    '- 每个选择都要改变至少一个具体细节或后续结果，不能只是换皮。',
    '- 最后必须回收 continuity.openingDetail 或 continuity.payoff，让故事闭合。',
    '',
    '【必须写出的因果过渡】',
    '第一幕：雷达异常 → 用户注意到一个具体前兆 → 做出选择',
    '第二幕：选择产生一个具体后果 → 这个后果触发本次因果变体 → 局势升级 → 再次选择',
    '第三幕：第二幕的选择留下代价或线索 → 前兆被回收 → 最后一次选择',
    '终幕：问题必须从“前兆 + 选择 + 代价”里自然长出来，不能突然讲人生道理',
    '',
    '【活力：像现场直播，不像报告】',
    '- 系统要有实时反应：等等、不是吧、我再看一眼、我这边信号在抖',
    '- 每个选择先改变一个具体东西：灯、灰、声音、位置、温度、压力，再谈感受',
    '- 允许系统说错再改口，允许短句、打断、停顿',
    '- 不要连续四句都以“你”开头，不要每段都总结升华',
    '- 每份剧本至少有两个具体的声音或触感细节',
    '',
    '【四幕结构】',
    '第一幕：' + b.acts[0].prompt,
    '第二幕：' + b.acts[1].prompt,
    '第三幕：' + b.acts[2].prompt,
    '终幕：一个不评判的灵魂反问，让用户自己回答。',
    '',
    '请写一个完整的四幕选择剧本，总字数 1000-1300 字。',
    '只输出合法 JSON，不要 markdown、代码块或解释。结构：',
    '{',
    '  "continuity": { "openingDetail": "开场埋下的一个细节", "causeChain": ["前兆→触发", "触发→后果", "后果→终幕回收"], "payoff": "终幕如何回收这个细节" },',
    '  "intro": ["8-10句开场：雷达扫描→Error→状态观察→安抚→理解→现实共鸣→那么现在→放空大脑→想象一下"],',
    '  "bridge": [],',
    '  "background": ["2-4句：地点是什么、为什么废弃/停用、现在有什么具体细节"],',
    '  "act1": { "lines": ["第一幕过渡1-3句"], "prompt": "第一幕问题", "options": [',
    '    { "text": "选项A", "feedback": ["1-2句"] },',
    '    { "text": "选项B", "feedback": ["1-2句"] },',
    '    { "text": "选项C", "feedback": ["1-2句"] }',
    '  ] },',
    '  "act2": { "lines": ["3-5句过渡"], "prompt": "第二幕问题", "options": [',
    '    { "text": "选项A", "feedback": ["1-2句"] },',
    '    { "text": "选项B", "feedback": ["1-2句"] },',
    '    { "text": "选项C", "feedback": ["1-2句"] }',
    '  ] },',
    '  "branches": { "A": ["2-4句"], "B": ["2-4句"], "C": ["2-4句"] },',
    '  "act3": { "lines": ["3-5句过渡"], "prompt": "第三幕问题", "options": [',
    '    { "text": "选项A", "feedback": ["1-2句"] },',
    '    { "text": "选项B", "feedback": ["1-2句"] },',
    '    { "text": "选项C", "feedback": ["1-2句"] }',
    '  ] },',
    '  "final": { "lines": ["3-5句终幕铺垫"], "prompt": "最后一个开放问题", "options": [',
    '    { "text": "选项A", "feedback": ["1-2句，不评判"] },',
    '    { "text": "选项B", "feedback": ["1-2句，不评判"] },',
    '    { "text": "选项C", "feedback": ["1-2句，不评判"] },',
    '    { "text": "选项D", "feedback": ["1-2句，不评判"] }',
    '  ] }',
    '}',
    '现在只输出 JSON。'
  ].filter(Boolean).join('\n');
}

app.post('/api/dialogue/prompt', async (req, res) => {
  const body = req.body || {};
  const dimension = String(body.dimension || '').toUpperCase();
  if(!DIALOGUE_BLUEPRINTS[dimension]) return res.status(400).json({ error: '维度不正确' });
  const address = dialogueSafeText(body.address, 20) || '你';
  const context = body.context && typeof body.context === 'object' ? body.context : {};
  const safeContext = {
    code: dialogueSafeText(context.code, 40),
    typeName: dialogueSafeText(context.typeName, 60),
    quantumState: ['good', 'danger', 'superposition'].includes(context.quantumState) ? context.quantumState : 'superposition',
    dimensionState: ['good', 'danger', 'superposition'].includes(context.dimensionState) ? context.dimensionState : 'superposition',
    ratios: {},
    lead: dialogueSafeText(context.lead, 8),
    gap: Number(context.gap) || 0
  };
  if(context.ratios && typeof context.ratios === 'object'){
    Object.keys(context.ratios).slice(0, 6).forEach(k => {
      safeContext.ratios[dialogueSafeText(k, 8)] = Math.max(0, Math.min(100, Number(context.ratios[k]) || 0));
    });
  }
  const nonce = dialogueSafeText(body.nonce, 48) || String(Date.now());
  const lang = DIALOGUE_LANG_NAMES[body.lang] ? body.lang : 'zh-CN';
  const prompt = buildDialoguePrompt(dimension, address, safeContext, nonce, lang);
  if(!prompt || prompt.length > 8500) return res.status(500).json({ error: '提示词生成失败' });
  res.json({ success: true, dimension: dimension, prompt: prompt });
});

// 4.8.5 全局 AI 配置（管理员设置一次，所有学生端自动接入）
const aiProxyHits = new Map();

async function readAIConfig(){
  try {
    const r = await pool.query('SELECT config, "updatedAt" FROM app_config WHERE id = $1', ['ai']);
    const row = r.rows[0];
    if(!row) return null;
    const cfg = row.config || {};
    return Object.assign({}, cfg, { updatedAt: Number(row.updatedAt) || 0 });
  } catch(e){ return null; }
}

app.get('/api/ai/config', async (req, res) => {
  const cfg = await readAIConfig();
  res.json({
    success: true,
    enabled: !!(cfg && cfg.enabled && cfg.key),
    hasKey: !!(cfg && cfg.key),
    model: cfg ? (cfg.model || '') : '',
    temperature: cfg ? (Number(cfg.temperature) || 0.85) : 0.85,
    maxTokens: cfg ? (Number(cfg.maxTokens) || 2400) : 2400,
    updatedAt: cfg ? cfg.updatedAt : 0
  });
});

app.get('/api/admin/ai-config', requireStudentAdmin, async (req, res) => {
  const cfg = await readAIConfig();
  res.json({
    success: true,
    enabled: !!(cfg && cfg.enabled),
    hasKey: !!(cfg && cfg.key),
    url: cfg ? (cfg.url || '') : '',
    model: cfg ? (cfg.model || '') : '',
    temperature: cfg ? (Number(cfg.temperature) || 0.85) : 0.85,
    maxTokens: cfg ? (Number(cfg.maxTokens) || 2400) : 2400,
    updatedAt: cfg ? cfg.updatedAt : 0
  });
});

app.post('/api/admin/ai-config', requireStudentAdmin, async (req, res) => {
  const body = req.body || {};
  const existing = await readAIConfig();
  const url = String(body.url || (existing && existing.url) || 'https://api.deepseek.com/chat/completions').trim();
  const key = String(body.key || (existing && existing.key) || '').trim();
  const model = String(body.model || (existing && existing.model) || 'deepseek-chat').trim().slice(0, 80);
  const temperature = Math.max(0, Math.min(1.5, Number(body.temperature) || 0.85));
  const maxTokens = Math.max(500, Math.min(2600, Number(body.maxTokens) || 2400));
  const enabled = body.enabled !== false;
  if(!/^https?:\/\//i.test(url)) return res.status(400).json({ error: '接口地址格式不正确' });
  if(!key) return res.status(400).json({ error: 'API Key 不能为空' });
  if(!model) return res.status(400).json({ error: '模型名称不能为空' });
  const cfg = { url, key, model, temperature, maxTokens, enabled };
  try {
    await pool.query(
      `INSERT INTO app_config (id, config, "updatedAt", "updatedBy")
       VALUES ('ai', $1, $2, 'Administrator')
       ON CONFLICT (id) DO UPDATE
       SET config = EXCLUDED.config, "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy"`,
      [JSON.stringify(cfg), Date.now()]
    );
    res.json({ success: true, hasKey: true, updatedAt: Date.now() });
  } catch (err) {
    console.error('[AI配置] 保存失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || 'unknown').trim();
  const now = Date.now();
  const slot = aiProxyHits.get(ip);
  if(slot && slot.resetAt > now){
    if(slot.count >= 30) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    slot.count++;
  } else {
    aiProxyHits.set(ip, { count: 1, resetAt: now + 60 * 1000 });
  }
  if(aiProxyHits.size > 3000){
    for(const [k, v] of aiProxyHits){ if(v.resetAt < now) aiProxyHits.delete(k); }
  }

  const body = req.body || {};
  const prompt = String(body.prompt || '');
  const system = String(body.system || '');
  if(!prompt || prompt.length > 9000) return res.status(400).json({ error: '提示词为空或过长' });
  if(system.length > 3000) return res.status(400).json({ error: '系统提示词过长' });
  const cfg = await readAIConfig();
  if(!cfg || !cfg.enabled || !cfg.key) return res.status(503).json({ error: 'AI 接口尚未配置', code: 'NO_API_CONFIG' });

  const temperature = Math.max(0, Math.min(1.5, Number(body.temperature) || Number(cfg.temperature) || 0.85));
  const maxTokens = Math.max(1, Math.min(Number(cfg.maxTokens) || 2400, Number(body.max_tokens) || 2400, 2600));
  try {
    const upstream = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model || 'deepseek-chat',
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.type('application/json');
    res.send(text);
  } catch (err) {
    console.error('[AI代理] 请求失败:', err.message);
    res.status(502).json({ error: 'AI 接口请求失败' });
  }
});

// 4.9 跨设备同步：历史问卷// 4.9 跨设备同步：历史问卷
app.get('/api/student/history', requireSyncAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT payload FROM quiz_records WHERE "studentEmail" = $1 ORDER BY "quizTs" DESC LIMIT 500`,
      [req.syncEmail]
    );
    res.json({ success: true, records: r.rows.map(row => row.payload).filter(Boolean) });
  } catch (err) {
    console.error('[历史同步] 读取失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

app.post('/api/student/history/sync', requireSyncAuth, async (req, res) => {
  const records = Array.isArray(req.body && req.body.records) ? req.body.records : null;
  if(!records) return res.status(400).json({ error: '参数不完整' });
  if(records.length > 500) return res.status(400).json({ error: '一次最多同步 500 条' });
  try {
    let saved = 0;
    for(const record of records){
      if(!record || typeof record !== 'object') continue;
      const ts = Number(record.ts);
      if(!ts || !record.answers) continue;
      const raw = JSON.stringify(record);
      if(raw.length > 200 * 1024) continue;
      await pool.query(
        `INSERT INTO quiz_records ("studentEmail", "quizTs", payload, "createdAt")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("studentEmail", "quizTs") DO UPDATE
         SET payload = EXCLUDED.payload, "createdAt" = EXCLUDED."createdAt"`,
        [req.syncEmail, ts, raw, Date.now()]
      );
      saved++;
    }
    res.json({ success: true, saved });
  } catch (err) {
    console.error('[历史同步] 保存失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.10 跨设备同步：设置与主页量子球配色
app.get('/api/student/settings', requireSyncAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT settings, "updatedAt" FROM account_settings WHERE "studentEmail" = $1',
      [req.syncEmail]
    );
    const row = r.rows[0];
    res.json({ success: true, settings: row ? row.settings : null, updatedAt: row ? Number(row.updatedAt) : 0 });
  } catch (err) {
    console.error('[设置同步] 读取失败:', err.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

app.put('/api/student/settings', requireSyncAuth, async (req, res) => {
  const settings = req.body && req.body.settings;
  if(!settings || typeof settings !== 'object') return res.status(400).json({ error: '参数不完整' });
  let raw;
  try { raw = JSON.stringify(settings); } catch(e){ return res.status(400).json({ error: '设置格式不正确' }); }
  if(raw.length > 50 * 1024) return res.status(400).json({ error: '设置内容过大' });
  const updatedAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO account_settings ("studentEmail", settings, "updatedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("studentEmail") DO UPDATE
       SET settings = EXCLUDED.settings, "updatedAt" = EXCLUDED."updatedAt"`,
      [req.syncEmail, raw, updatedAt]
    );
    res.json({ success: true, updatedAt });
  } catch (err) {
    console.error('[设置同步] 保存失败:', err.message);
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
    if (err.code === 'STUDENT_BIND_LIMIT' || String(err.message || '').indexOf('STUDENT_BIND_LIMIT') >= 0) {
      return res.status(409).json({ error: '该学生已达到绑定上限（最多绑定 2 位家长）' });
    }
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

    res.json({ success: true, list, maxStudents: null, unlimited: true });
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
    /* 双报告隔离：同一次问卷的学生同步不能覆盖家长 AI；新问卷则清掉上一份家长 AI */
    let prevReportPayload = null;
    try {
      const prevReport = await pool.query('SELECT payload FROM reports WHERE "studentEmail" = $1', [se]);
      prevReportPayload = prevReport.rows[0] && prevReport.rows[0].payload;
    } catch(e){}
    const sameQuiz = !!(prevReportPayload && Number(prevReportPayload.quizTs) === quizTs);
    const isOlderQuiz = !!(prevReportPayload && Number(prevReportPayload.quizTs) > quizTs);
    if (sameQuiz) {
      const parentAudience = !!(prevReportPayload && prevReportPayload.aiReportAudience === 'parent');
      if (prevReportPayload && prevReportPayload.aiReport && !parentAudience) {
        /* 旧版学生生成的家长向报告没有 audience 标记：清掉，避免串到家长端 */
        payload.aiReport = null;
        payload.aiReportLang = null;
        payload.aiReportSource = null;
        payload.aiReportAt = null;
        payload.aiReportAudience = null;
      } else {
        /* 家长端已生成的报告：保留数据库中的家长 AI */
        delete payload.aiReport;
        delete payload.aiReportLang;
        delete payload.aiReportSource;
        delete payload.aiReportAt;
        delete payload.aiReportAudience;
      }
    } else if (prevReportPayload) {
      /* 新学期/新问卷：上一份家长 AI 不能串到这一次 */
      payload.aiReport = null;
      payload.aiReportLang = null;
      payload.aiReportSource = null;
      payload.aiReportAt = null;
      payload.aiReportAudience = null;
    }

    /* 管理员回填历史时，不要把家长端已经生成的 AI 报告覆盖掉 */
    if (se === 'administrator@qbti.local') {
      try {
        const prev = await pool.query(
          'SELECT payload FROM admin_quiz_records WHERE "studentEmail" = $1 AND "quizTs" = $2',
          [se, quizTs]
        );
        const prevPayload = prev.rows[0] && prev.rows[0].payload;
        if (prevPayload && prevPayload.aiReport && prevPayload.aiReportAudience === 'parent' && !payload.aiReport) {
          payload.aiReport = prevPayload.aiReport;
          payload.aiReportLang = prevPayload.aiReportLang;
          payload.aiReportSource = prevPayload.aiReportSource;
          payload.aiReportAt = prevPayload.aiReportAt;
          payload.aiReportAudience = 'parent';
        }
      } catch(e){}
    }
    /* 回填旧历史时不能把当前最新的 reports 覆盖回旧问卷 */
    if (!isOlderQuiz) {
      await pool.query(
        `INSERT INTO reports ("studentEmail", "studentUsername", payload, "updatedAt")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("studentEmail") DO UPDATE 
         SET "studentUsername" = EXCLUDED."studentUsername",
             payload = COALESCE(reports.payload, '{}'::jsonb) || EXCLUDED.payload,
             "updatedAt" = EXCLUDED."updatedAt"`,
        [se, studentUsername || '', JSON.stringify(payload), updatedAt]
      );
    }
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