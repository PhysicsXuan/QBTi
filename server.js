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
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  statement_timeout: 12000,
  query_timeout: 12000
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
    `CREATE TABLE IF NOT EXISTS student_bans (
      email VARCHAR(255) PRIMARY KEY,
      username VARCHAR(100),
      reason TEXT,
      "bannedAt" BIGINT,
      "updatedBy" VARCHAR(255)
    );`,
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
      try {
        await pool.query(q);
      } catch (queryErr) {
        console.error('⚠️ 数据库表初始化单条失败:', queryErr.message.slice(0, 180));
      }
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
  if(await isStudentBanned(email)){
    return res.status(403).json({ error: '该账号已被管理员禁用', code: 'USER_BANNED' });
  }
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

/* ---------- 全服功能开关 / 用户黑名单 ---------- */
const DEFAULT_FEATURE_FLAGS = {
  quiz: true,
  explanation: true,
  story: true,
  report: true,
  feedback: true
};
const FEATURE_KEYS = Object.keys(DEFAULT_FEATURE_FLAGS);
async function readFeatureFlags(){
  try {
    const r = await pool.query('SELECT config FROM app_config WHERE id = $1', ['features']);
    const raw = r.rows[0] && r.rows[0].config ? r.rows[0].config : {};
    const out = Object.assign({}, DEFAULT_FEATURE_FLAGS);
    FEATURE_KEYS.forEach(k => { if(typeof raw[k] === 'boolean') out[k] = raw[k]; });
    return out;
  } catch(e){
    return Object.assign({}, DEFAULT_FEATURE_FLAGS);
  }
}
async function writeFeatureFlags(patch, updatedBy){
  const current = await readFeatureFlags();
  const next = Object.assign({}, current);
  FEATURE_KEYS.forEach(k => { if(patch && typeof patch[k] === 'boolean') next[k] = patch[k]; });
  await pool.query(
    `INSERT INTO app_config (id, config, "updatedAt", "updatedBy")
     VALUES ('features', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy"`,
    [JSON.stringify(next), Date.now(), updatedBy || 'administrator']
  );
  return next;
}
async function isStudentBanned(email){
  const e = String(email || '').toLowerCase().trim();
  if(!e || e === 'administrator@qbti.local') return false;
  try {
    const r = await pool.query('SELECT email FROM student_bans WHERE LOWER(email) = $1', [e]);
    return r.rows.length > 0;
  } catch(e){ return false; }
}
async function resolveSessionEmailAllowBanned(req){
  const token = studentAdminTokenFromReq(req);
  if(!token) return null;
  const admin = studentAdminTokens.get(token);
  if(admin && admin.expires > Date.now()) return 'administrator@qbti.local';
  try {
    const r = await pool.query('SELECT email FROM student_sessions WHERE token = $1 AND "expiresAt" > $2', [token, Date.now()]);
    return r.rows[0] ? String(r.rows[0].email).toLowerCase() : null;
  } catch(e){ return null; }
}

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
  if(await isStudentBanned(emailLower)){
    return res.status(403).json({ error: '该账号已被管理员禁用', code: 'USER_BANNED' });
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
    if(await isStudentBanned(user.email)){
      return res.status(403).json({ error: '该账号已被管理员禁用', code: 'USER_BANNED' });
    }
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
    if(await isStudentBanned(emailLower)){
      return res.status(403).json({ error: '该账号已被管理员禁用', code: 'USER_BANNED' });
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
      await client.query('DELETE FROM student_bans WHERE LOWER(email) = $1', [emailLower]);
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
  const featureFlags = await readFeatureFlags();
  if(!featureFlags.feedback) return res.status(403).json({ error: '反馈功能已被管理员关闭', code: 'FEATURE_DISABLED' });
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

const DIALOGUE_SUB_NAMES_ZH = { X:'探索欲', C:'创造', A:'适应', U:'好奇', P:'热情', M:'意义', I:'主动', D:'独立', E:'坚持', T:'容忍', H:'挑战', R:'韧性' };
const DIALOGUE_SUB_NAMES_EN = { X:'Exploration', C:'Creativity', A:'Adaptation', U:'Curiosity', P:'Passion', M:'Meaning', I:'Initiative', D:'Independence', E:'Endurance', T:'Tolerance', H:'Challenge', R:'Resilience' };
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

const DIALOGUE_BLUEPRINTS_EN = {
  PO: {
    name: 'Potential Openness',
    scene: 'an abandoned observatory control room with a faded star map, a dormant radio receiver and a long-sealed observation door',
    link: 'the old radio receiver still blinking on the wall and the seam in the star map',
    background: 'the observatory was shut down more than ten years ago; the roof supports creak, rust falls from the star-map seam, and the old receiver is still on standby',
    metaphor: 'the sealed door may lead to new observation data, or to nothing at all',
    forbidden: 'do not turn the scene into a generic locked door, shelter, apocalypse, monster, train, library or lighthouse',
    logic: 'the radar anomaly must grow from a concrete physical precursor: a loose rivet, falling dust, a temperature change, or wind through the star-map seam'
  },
  II: {
    name: 'Intrinsic Interest',
    scene: 'an old train stopped on a circular track, its boiler cold, one dim lamp still burning in the cab',
    link: 'the old broadcast radio and pressure gauge in the driver cab',
    background: 'the mining line was abandoned years ago; coal dust covers the floor, the tunnel walls carry old maintenance marks, and the boiler has been cold for a long time',
    metaphor: 'whether to relight the fire, knowing the next tunnel may still be dark',
    forbidden: 'do not turn the scene into a generic locked door, shelter, apocalypse, monster, observatory, library or lighthouse',
    logic: 'the radar anomaly must be caused by something already present: a pressure drop, a loose coupling, coal dust, or a failing gauge'
  },
  LA: {
    name: 'Learning Agency',
    scene: 'a library closed for years, where the checkout terminal still glows and the shelves sit on old rails',
    link: 'the green terminal on the checkout desk and a map left by the previous reader',
    background: 'the library closed long ago; damp has reached the lower shelves, the rails are worn, and the terminal still holds an unfinished borrowing record',
    metaphor: 'whether to follow the map left by someone else, or draw a route of your own',
    forbidden: 'do not turn the scene into a generic locked door, shelter, apocalypse, monster, observatory, train or lighthouse',
    logic: 'the radar anomaly must come from an existing detail: a jammed rail, a damp page, a flickering terminal, or a mark on the old map'
  },
  UR: {
    name: 'Uncertainty Response',
    scene: 'a dark sea at night, a decommissioned lighthouse, fog, a radio running on an old generator and a tide that is going out',
    link: 'the radio at the base of the lighthouse and the foghorn with unstable voltage',
    background: 'the lighthouse was taken out of service years ago; the generator is weak, the fuel gauge is almost empty, and black reef edges appear when the tide recedes',
    metaphor: 'whether to trust a sound in the fog, or wait until the sea shows its shape',
    forbidden: 'do not turn the scene into a generic locked door, shelter, apocalypse, monster, observatory, train or library',
    logic: 'the radar anomaly must be tied to an existing detail: unstable voltage, a tide change, a fog signal, or a failing generator'
  }
};


/* 每次生成从不同地点/背景变体中选择；同一 IP+维度最近两次不会重复 */
const DIALOGUE_SCENE_VARIANTS = {
  PO: [
    { id: 'po-dome', zh: { scene: '废弃天文台的圆顶观测室，锈死的赤道仪还指着旧坐标，星图接缝在漏灰', link: '圆顶轨道旁的旧射电接收器和卡住的观测门', background: '天文台停用多年，圆顶电机早就坏了，夜里温差让金属接缝不断响，墙角堆着掉落的铆钉，接收器却还在待机', metaphor: '那扇门后可能是一组新坐标，也可能只是更多灰尘' }, en: { scene: 'the dome room of an abandoned observatory, its seized equatorial mount still aimed at an old coordinate while dust leaks through the star-map seam', link: 'the old radio receiver beside the dome rail and the jammed observation door', background: 'the observatory has been closed for years; the dome motor is dead, temperature changes make the metal seams tick at night, fallen rivets gather in the corner, yet the receiver is still on standby', metaphor: 'behind the door may be a new coordinate set, or simply more dust' } },
    { id: 'po-roof', zh: { scene: '天文台屋顶的天线平台，清晨的风把校准塔吹得轻轻摇晃，脚下是三米高的旧护栏', link: '校准塔上的风向标和一段断掉的同轴电缆', background: '屋顶平台多年无人维护，护栏有一截缺口，风向标的轴承干涩，断掉的同轴电缆偶尔还会冒出微弱电流声', metaphor: '是修好那根线继续听，还是承认这个频段早就没有信号' }, en: { scene: 'the antenna platform on the observatory roof at dawn, the calibration tower swaying in the wind above a three-meter drop and an old guard rail', link: 'the wind vane on the calibration tower and a severed coaxial cable', background: 'the roof platform has gone unmaintained for years; one guard-rail section is missing, the vane bearing is dry, and the cut cable still occasionally clicks with weak current', metaphor: 'repair the cable and keep listening, or admit this band has been silent for years' } },
    { id: 'po-vault', zh: { scene: '天文台地下的数据保管室，磁带上落着厚灰，旧地震仪还在纸上画着几乎看不见的线', link: '地震仪旁的手摇录音机和一盒标着“未归档”的磁带', background: '地下保管室原本用来存观测数据，除湿机早已停摆，墙上水渍把标签泡烂，只有地震仪还靠备用电池画线', metaphor: '要不要把一盒没有归档的过去，重新放进机器里' }, en: { scene: 'the underground data vault of the observatory, thick dust on magnetic tapes while an old seismograph draws an almost invisible line', link: 'the hand-crank recorder beside the seismograph and a tape marked “unfiled”', background: 'the vault once stored observation data; the dehumidifier died long ago, water stains have ruined the labels, and only the seismograph still draws on backup battery', metaphor: 'whether to put an unfiled piece of the past back into the machine' } }
  ],
  II: [
    { id: 'ii-depot', zh: { scene: '废弃矿区的环形轨道检修库，一辆旧列车停在转盘上，锅炉冷得像一块铁', link: '检修库墙上的压力表和驾驶室里的旧广播', background: '矿区停产后检修库被封，轨道缝里长满黑色杂草，工具柜上还挂着上一班司机的名牌，广播偶尔自己响一下', metaphor: '要不要重新点火，明知下一段隧道仍然没有灯' }, en: { scene: 'the maintenance depot on the mine’s circular track, an old train parked on the turntable with a boiler cold as iron', link: 'the pressure gauge on the depot wall and the old broadcast radio in the cab', background: 'the mine closed and the depot was sealed; black weeds grow between the rails, the last driver’s name tag still hangs on the tool cabinet, and the radio occasionally crackles on its own', metaphor: 'whether to relight the fire knowing the next tunnel is still dark' } },
    { id: 'ii-cab', zh: { scene: '列车驾驶室，挡风玻璃上全是煤灰，唯一一盏灯照着发抖的压力表', link: '驾驶室里的旧广播、气压表和一根卡住的操纵杆', background: '这辆车被留在侧线上多年，驾驶室门变形，煤灰从窗缝灌进来，广播里只有一阵阵静电，操纵杆偶尔自己动一下', metaphor: '是相信仪表还能读数，还是相信窗外那条没有尽头的小轨道' }, en: { scene: 'the train cab, coal dust over the windshield and one lamp lighting a trembling pressure gauge', link: 'the old radio, the pressure gauge and a stuck control lever', background: 'the train has been left on a siding for years; the cab door is warped, coal dust blows through the window seams, the radio is mostly static, and the lever sometimes moves on its own', metaphor: 'trust the gauge, or trust the endless little track outside' } },
    { id: 'ii-tunnel', zh: { scene: '隧道口的信号机房，墙上挂满褪色的调度牌，铁轨从黑暗里伸出来又缩回去', link: '信号机房的旧电话交换台和隧道壁上的检修灯', background: '隧道停用后信号机房还通着弱电，调度牌上的字被潮气泡花，检修灯隔几秒闪一次，铁轨上留着新鲜煤灰', metaphor: '是沿着旧信号走，还是承认这套调度早已失效' }, en: { scene: 'the signal room at the tunnel mouth, faded dispatch boards on the wall while rails slide out of the dark and back in', link: 'the old telephone switchboard and the maintenance lamp on the tunnel wall', background: 'the tunnel is closed but the signal room still has weak power; damp has blurred the dispatch boards, a maintenance lamp blinks every few seconds, and fresh coal dust sits on the rails', metaphor: 'follow the old signal, or admit the dispatch system stopped being true long ago' } }
  ],
  LA: [
    { id: 'la-desk', zh: { scene: '闭馆图书馆的借阅台，绿色终端还亮着，台灯下压着一张写到一半的借阅单', link: '借阅台上的绿色终端和上一位读者留下的手绘地图', background: '图书馆闭馆多年，借阅台却还有电，终端里留着一条没完成的借阅记录，地图边缘有铅笔写的小字，书架在暗处轻轻响', metaphor: '是照着别人的地图走，还是自己画一条新的路线' }, en: { scene: 'the checkout desk of a closed library, a green terminal still glowing over a half-written borrowing slip', link: 'the green terminal on the desk and a hand-drawn map left by the previous reader', background: 'the library has been closed for years, yet the desk still has power; the terminal holds an unfinished loan record, pencil notes sit at the map’s edge, and the shelves creak softly in the dark', metaphor: 'follow someone else’s map, or draw a new route' } },
    { id: 'la-archive', zh: { scene: '图书馆地下档案室，一排排移动书架停在半途，地上有旧轨道的黑色油迹', link: '移动书架旁的摇柄和一张被压在书脊下的索书号', background: '档案室靠机械轨道移动书架，停电后书架卡在半开的位置，湿气让书页粘在一起，摇柄上还留着上一位管理员的手印', metaphor: '是用力摇开一条路，还是从卡住的缝里侧身进去' }, en: { scene: 'the library’s underground archive, rows of movable shelves frozen halfway open and black oil marks along the old rails', link: 'the crank beside the movable shelves and a call number pressed under a book spine', background: 'the archive moves its shelves on mechanical rails; after the power cut they stuck half-open, damp has glued pages together, and a former librarian’s handprint remains on the crank', metaphor: 'force a path open, or slip sideways through the stuck gap' } },
    { id: 'la-map', zh: { scene: '图书馆的旧地图阅览室，长桌上摊着卷边的城市图，窗外的光只够照亮一半', link: '地图柜里一叠手绘路线和桌角压着的断铅笔', background: '地图室很久没人来，窗帘卡在一半，城市图上有几处被反复描过的线，地图柜最底层压着一叠没有署名的路线图', metaphor: '是沿着被描过很多次的线走，还是把空白处补完' }, en: { scene: 'the old map reading room, curled city maps spread on a long table while only half of each is lit by the window', link: 'a stack of hand-drawn routes in the map cabinet and a broken pencil at the table corner', background: 'no one has visited the map room for years; the curtain is stuck half-open, several city-map lines have been traced over and over, and an unsigned stack of routes sits at the bottom of the cabinet', metaphor: 'follow the lines traced many times, or fill in the blank space' } }
  ],
  UR: [
    { id: 'ur-base', zh: { scene: '停用灯塔底层的无线电室，发电机在墙角断续敲击，雾从门缝里钻进来', link: '灯塔底层的旧无线电和电压不稳的雾笛', background: '灯塔停用多年，发电机只够带一盏灯，无线电偶尔收到远处船鸣，雾笛的电压表在红区边缘抖动，门外潮水正在退', metaphor: '是相信雾里的声音，还是等海面自己露出形状' }, en: { scene: 'the radio room at the base of a decommissioned lighthouse, a generator knocking in the corner while fog slips under the door', link: 'the old radio at the lighthouse base and the unstable foghorn', background: 'the lighthouse has been out of service for years; the generator can barely power one lamp, the radio occasionally catches a distant ship horn, the foghorn voltage needle trembles at the red edge, and the tide is going out', metaphor: 'trust the sound in the fog, or wait for the sea to show its shape' } },
    { id: 'ur-cliff', zh: { scene: '悬崖边的雾号站，铁架被海风锈得发红，脚下能听见浪撞暗礁的声音', link: '雾号站的手摇报警器和一根被盐腐蚀的电缆', background: '悬崖雾号站早已废弃，铁架有一根横梁松脱，报警器还能用手摇，盐雾让电缆外皮开裂，退潮时暗礁露出黑边', metaphor: '是拉响警报，还是先确认那声音到底来自哪里' }, en: { scene: 'the fog-signal station on the cliff, its iron frame rusted red by sea wind and waves audible against the reef below', link: 'the hand-crank alarm and a salt-eaten cable', background: 'the cliff station was abandoned long ago; one crossbeam is loose, the alarm can still be hand-cranked, salt fog has split the cable sheath, and black reef edges appear as the tide falls', metaphor: 'sound the alarm, or first confirm where the sound is coming from' } },
    { id: 'ur-hut', zh: { scene: '海边的旧潮位观测棚，水尺被海藻缠住，桌上摊着一本被盐粘住的记录簿', link: '潮位棚里的手摇电话和棚外一根倾斜的标杆', background: '潮位棚停用后只剩一个铁皮屋，屋顶漏水，记录簿的纸页粘在一起，标杆被浪打歪，夜里能听到浮标钢索的低频摩擦', metaphor: '是相信记录簿上的旧潮位，还是相信今晚正在上涨的水' }, en: { scene: 'the old tide-gauge hut by the sea, a water gauge tangled in seaweed and a salt-stuck logbook open on the table', link: 'the hand-crank telephone inside the hut and a leaning marker post outside', background: 'only a tin hut remains after the tide station closed; the roof leaks, logbook pages are glued by salt, the marker post is knocked askew, and at night the buoy cable makes a low scraping sound', metaphor: 'trust the old tide levels in the logbook, or the water rising tonight' } }
  ]
};
const dialogueRecentScenes = new Map();
function chooseDialogueVariant(dimension, ip){
  const list = DIALOGUE_SCENE_VARIANTS[dimension] || [];
  if(!list.length) return null;
  const key = String(ip || 'unknown') + '|' + dimension;
  const recent = dialogueRecentScenes.get(key) || [];
  let candidates = list.filter(v => recent.indexOf(v.id) < 0);
  if(!candidates.length) candidates = list.slice();
  const variant = candidates[Math.floor(Math.random() * candidates.length)];
  recent.push(variant.id);
  dialogueRecentScenes.set(key, recent.slice(-2));
  if(dialogueRecentScenes.size > 2000) dialogueRecentScenes.clear();
  return variant;
}

function buildDialoguePromptEnglish(dimension, address, context, nonce, lang, variant){
  const b = DIALOGUE_BLUEPRINTS_EN[dimension];
  if(!b) return null;
  const v = variant && variant.en ? variant.en : null;
  const sceneText = (v && v.scene) || b.scene;
  const linkText = (v && v.link) || b.link;
  const backgroundText = (v && v.background) || b.background;
  const metaphorText = (v && v.metaphor) || b.metaphor;
  const logicText = b.logic;
  const variantId = (variant && variant.id) || (dimension + '-base');
  const c = context || {};
  const target = DIALOGUE_LANG_NAMES[lang] || 'English';
  const stateText = c.dimensionState === 'danger' ? 'danger / not yet collapsed'
    : c.dimensionState === 'good' ? 'good / direction is clear'
    : 'superposition / direction not fixed';
  const ratios = c.ratios && typeof c.ratios === 'object'
    ? Object.keys(c.ratios).slice(0, 6).map(k => dialogueSafeText(k, 8) + '=' + (Number(c.ratios[k]) || 0) + '%').join(' / ')
    : '';
  const addressText = dialogueSafeText(address, 20) || 'you';
  const stateMode = c.dimensionState === 'danger' ? 'danger' : c.dimensionState === 'good' ? 'good' : 'superposition';
  const ratioEntries = Object.keys(c.ratios || {}).map(k => [dialogueSafeText(k, 8), Number(c.ratios[k]) || 0]).sort((a, b) => b[1] - a[1]);
  const leadCode = dialogueSafeText(c.lead, 8) || (ratioEntries[0] ? ratioEntries[0][0] : '');
  const leadRatio = (ratioEntries.find(x => x[0] === leadCode) || ratioEntries[0] || [leadCode, 0])[1];
  const leadText = leadCode ? ((DIALOGUE_SUB_NAMES_EN[leadCode] || leadCode) + (leadRatio ? ' (' + leadRatio + '%)' : '')) : 'the brightest current signal';
  const stateRadar = stateMode === 'danger'
    ? 'RADAR: the signal is interrupted/lost; the channel is hollow and the system cannot lock a clean direction.'
    : stateMode === 'good'
      ? 'RADAR: the signal is clear; all channels are open, communications are green, and the lock is stable.'
      : 'RADAR: two or three frequencies overlap; interference is visible, phase drift continues, and none of them has collapsed.';
  const errorCodesByState = {
    danger: ['Error 404 Signal Not Found', 'Error 403 Signal Lost', 'Error 502 Echo Lost'],
    good: ['Signal 000 · Locked', 'Signal 200 · Comms Open', 'Signal 101 · Radar Clear'],
    superposition: ['Signal 207 · Two Frequencies', 'Signal 302 · Phase Drift', 'Signal 418 · Interference']
  };
  const errorCode = errorCodesByState[stateMode][Math.floor(Math.random() * errorCodesByState[stateMode].length)];
  const episodeRules = [
    'CLEAR ANIMATED-EPISODE RULES:',
    '- This is a 4-scene animated episode, not a novel, prose poem or mood piece. The user must always know: where they are, what they want right now, what is physically blocking them, and what each option will try to do.',
    '- One location, one visible objective, one escalating problem. Do not introduce an unrelated new mystery in Act 2 or Act 3.',
    '- Every act follows: visible goal → concrete obstacle → three different physical actions → immediate visible result. Each act ends with a clear new question caused by that result.',
    '- Keep lines short and playable: action, object, system reaction, dialogue. At most one short metaphor per scene; immediately translate it into something the user can see or touch.',
    '- The system is an animated sidekick: it reacts in real time, gets embarrassed, overconfident or panicked, and makes visual mistakes. Humor comes from the equipment and the system, never from mocking the user.',
    '- The three options must be three different actions with different costs, not three moods or three rephrasings. Feedback must show the immediate consequence and hand a clear next beat to the next act.',
    '- No time skips, no sudden events, no “and then everything changed”. Every transition needs a physical cause the user could point to.'
  ].join('\n');
  const introRhythm = stateMode === 'danger'
    ? 'Write 8-10 short intro lines in this order: "—beep…" → "I’m scanning your [dimension] radar…" → the state-matched code → a concrete radar reading → "the channel is quiet right now; that is a reading of the equipment, not a judgment about you" → "I won’t rush you" → a grounded real-life line about how many unknowns a person meets every day → "so now…" → "shut down the console… empty your mind… follow the words…" → "imagine…". Do NOT say "I understand why you are in this state" or imply the user is broken, lazy or abnormal.'
    : stateMode === 'good'
      ? 'Write 8-10 short intro lines in this order: "—beep…" → "I’m scanning your [dimension] radar…" → the state-matched code → a clear, stable reading → "your [strongest subdimension] is especially strong at [ratio] — that is a real advantage" → praise this specific strength without flattery or generic encouragement → "I’m not here to fix you; let’s see how far this strength can go" → a grounded real-life line → "so now…" → "shut down the console… empty your mind… follow the words…" → "imagine…". Do NOT say "I understand why you are in this state", "don’t worry", or imply anything is wrong with the user.'
      : 'Write 8-10 short intro lines in this order: "—beep…" → "I’m scanning your [dimension] radar…" → the state-matched code → a reading that shows two or more real frequencies → "both signals are real; holding two possibilities is not a flaw" → "we don’t have to collapse this yet" → a grounded real-life line → "so now…" → "shut down the console… empty your mind… follow the words…" → "imagine…". Do NOT say "I understand why you are in this state", call the user indecisive, or imply the superposition is a problem to fix.';
  const stateContract = stateMode === 'danger'
    ? [
        'STATE-SPECIFIC CONTRACT — DANGER / NOT YET COLLAPSED: HELP THE USER FIND A DIRECTION',
        '- The ball is unstable and its direction is not locked. The script is not therapy and not a pep talk; it must let the user feel which of several concrete directions carries more energy. Never imply the user is deficient; describe the signal and the situation.',
        '- Each act must test a different direction, not rephrase the same choice. Options must point to concrete directions, concrete costs and concrete next moves.',
        '- The user may choose uncertainty or observation first, but each choice must make one direction slightly clearer.',
        '- The final question only helps the user name “which direction I am willing to test first”; do not demand a long-term commitment or decide for them.'
      ].join('\n')
    : stateMode === 'good'
      ? [
          'STATE-SPECIFIC CONTRACT — GOOD / DIRECTION IS CLEAR: AMPLIFY THE STRONGEST DIRECTION',
          '- The ball already has a clear direction. Its strongest subdimension is ' + leadText + '. The script must recognize and amplify this strength rather than reopening every direction. Praise this specific strength with the actual ratio or evidence; do not give generic flattery.',
          '- Each act raises the challenge: first use the strength on a small problem → let it meet real resistance → migrate it to a larger scene.',
          '- Options should show different uses of the same strength; do not write “you are already fine, so do nothing.” The good state needs an extension, not stagnation.',
          '- The final question invites one concrete next step in the strongest direction, without commanding or deciding for the user.'
        ].join('\n')
      : [
          'STATE-SPECIFIC CONTRACT — SUPERPOSITION / DIRECTION NOT FIXED: TEST INSIDE THE SUPERPOSITION',
          '- The ball is sitting between several possibilities. Let at least two real impulses appear and interfere; do not force a collapse in Act 1. Both impulses are valid; never call the user indecisive or imply the superposition is a defect.',
          '- Structure: two possibilities coexist → the choice creates interference or a cost → a small measurement that does not kill the other side.',
          '- Options must include different strategies such as “hold both”, “test a little”, “step back and observe”; let the user experience the tension of superposition.',
          '- Branches should retain traces of both possibilities; the final question helps the user notice which side is more coherent, not choose for them.'
        ].join('\n');
  const stateActs = stateMode === 'danger'
    ? [
        'Act 1: the radar breaks up; the scene offers three different direction clues. The user chooses which one to approach first, revealing what they want to protect or fight for.',
        'Act 2: the choice has a concrete consequence; another direction appears as interference. The user decides whether to continue, switch or pause.',
        'Act 3: a small experiment lets the user test a direction through action; the cost or clue pays off the first precursor.',
        'Final: if they could carry only one direction forward, which step would they try first? Options point to different directions without demanding a long commitment.'
      ]
    : stateMode === 'good'
      ? [
          'Act 1: the signal locks; the scene offers a concrete challenge where ' + leadText + ' can be used. The user chooses how to use the strength.',
          'Act 2: the strength meets real resistance or a cost and must level up rather than retreat; the user chooses the upgrade.',
          'Act 3: migrate the strength to a larger scene and pay off the first precursor; the user chooses how far to extend.',
          'Final: an invitation to push the strongest direction one step forward; options are different forms of the next step, not generic life advice.'
        ]
      : [
          'Act 1: two real impulses appear together; the user chooses which one to hold or observe first, without being forced into an either/or.',
          'Act 2: the two directions interfere and produce a third pattern or a cost; the user chooses how to continue without killing the other side.',
          'Act 3: a small measurement lets the superposition show itself without fully collapsing; the first precursor pays off.',
          'Final: which side feels more coherent or more ready to be seen? Options keep room for both possibilities and do not choose for the user.'
        ];
  const openingAngles = ['a half-finished complaint from the system', 'a broken notification tone', 'a smell that should not be there', 'a very small action nobody noticed', 'one wrong detail in the environment'];
  const openingAngle = openingAngles[Math.floor(Math.random() * openingAngles.length)];
  const moods = ['the system is sleepy', 'the system is secretly panicking', 'the system is pretending to be calm', 'the system just got embarrassed', 'the system is holding itself together'];
  const mood = moods[Math.floor(Math.random() * moods.length)];
  return [
    'You are the QBTI quantum-state system. Your first-person voice is "I"; the user is "you".',
    'OUTPUT LANGUAGE: ' + target + '. Every string value in the JSON must be written in ' + target + '. Do not write Chinese characters. The JSON keys stay in English.',
    'You are guiding the user through one immersive dimensional dialogue.',
    '',
    'DIMENSION: ' + b.name,
    'SCENE: ' + sceneText,
    'RADAR LINK: ' + linkText,
    'BACKGROUND MATERIAL: ' + backgroundText,
    'CORE METAPHOR: ' + metaphorText,
    'FORBIDDEN: ' + b.forbidden,
    'CAUSAL RULE: ' + logicText,
    'SCENARIO VARIANT: ' + variantId + ' — treat this as a new episode, not a rewrite of the sample. Invent at least three concrete details that are not in the background material and do not reuse the previous episode’s location name, first object, first action or opening sentence.',
    'Generation nonce: ' + dialogueSafeText(nonce, 48),
    'Opening angle for this run: ' + openingAngle,
    'System mood: ' + mood,
    'This is a fresh generation. Do not reuse the previous opening, sentence patterns, options, feedback or metaphors.',
    '',
    'RADAR OPENING (MANDATORY):',
    '- The first 2-4 intro lines must show "I" scanning the user’s radar for this dimension.',
    '- Include the word "Error" only for danger; for good/superposition include "Signal" or "Status". Use exactly this state-matched code: ' + errorCode + '.',
    '- Include at least one of: scan, probe, radar.',
    stateRadar,
    '- Words like lost, weak, stuck or interrupted describe the channel, never the user. Do not blame or diagnose the user. For good, explicitly name and praise the strongest subdimension (with its ratio). For superposition, explicitly say both signals are real and valid.',
    '- Do not use "No Found" for a good or superposition state. Good must explicitly report clear signal / open communications / stable lock. Superposition must explicitly report overlapping frequencies / interference / phase drift. Danger may use lost/not found.',
    '- The anomaly must cause or foreshadow the first concrete detail in Act 1. It cannot be decorative.',
    '',
    'INTRO RHYTHM:',
    introRhythm,
    '- Include the equivalent of "empty your mind", "follow the words" and "imagine" in the target language. Do not skip these three beats.',
    '- No-blame rule: the radar describes the channel, equipment and signal, never the user’s worth or personality. Never imply the user is broken, lazy, negative, abnormal or “in a bad state”.',
    '',
    'RADAR → SCENE:',
    '- Do not jump to the scene immediately after the error.',
    '- If the intro ends with an imagination transition, set "bridge" to an empty array [].',
    '- Otherwise write 1-3 bridge lines connecting the signal to: ' + linkText + '.',
    '- Always write 2-4 background lines: what the place is, why it was abandoned, and two concrete details from the background material.',
    '',
    'USER CONTEXT:',
    'Home questionnaire code: ' + dialogueSafeText(c.code, 40),
    'Dimension state: ' + stateText,
    'Overall state: ' + (c.quantumState === 'danger' ? 'danger, main direction unclear' : 'not in danger state'),
    ratios ? 'Within-dimension ratios: ' + ratios : '',
    c.lead ? 'Leading subdimension: ' + dialogueSafeText(c.lead, 8) + (c.gap != null ? ', gap ' + (Number(c.gap) || 0) + '%' : '') : '',
    'Address the user as: "' + addressText + '". If the name is "you", use "you".',
    '',
    stateContract,
    '',
    episodeRules,
    '',
    'NON-NEGOTIABLE RULES:',
    '- Do not define, label, diagnose or judge the user.',
    '- Do not say "you should", "you must", "you need to", "I suggest you", or "believe in yourself".',
    '- Do not give answers or make decisions for the user.',
    '- Do not mention parents, teachers, AI, models, scores, assessment or reports.',
    '- The user is always your teammate. Humor comes from the system, the equipment and the absurd situation, never from mocking the user.',
    '- Describe behavior, not personality labels.',
    '',
    'CAUSALITY AND CONTINUITY:',
    '- No sudden cracks, sudden sounds, sudden shadows or sudden messages. Every anomaly needs a physical precursor: a loose support, dust, temperature, tide, worn rail, weak voltage or a consequence of the previous choice.',
    '- Act 1 plants a concrete detail. Act 2 makes it matter. Act 3 pays off the cost or clue.',
    '- Each choice must change at least one concrete thing: light, dust, sound, position, temperature or pressure.',
    '- The final question must grow naturally from the experience. Do not start preaching.',
    '',
    'STRUCTURE — FOLLOW THE STATE-SPECIFIC ACT PLAN:',
    '- Each act begins by naming a visible goal in one short line, then shows the obstacle through action. The user should never have to guess what the scene is about.',
    ...stateActs,
    '- Every act has 3 options; the final has 4 options.',
    '- Every option needs 1-2 feedback lines. Do not leave feedback empty.',
    '- Include branches A, B and C, each 2-4 lines.',
    '- Keep the whole script around 500-700 words. Prefer clear action and jokes over long literary description.',
    '- Do not end lines with the Chinese full stop "。"; use the target language’s normal punctuation.',
    '',
    'OUTPUT: valid JSON only, no markdown, no code fence, no explanation. Schema:',
    '{',
    '  "continuity": { "openingDetail": "a concrete detail planted early", "causeChain": ["precursor→trigger", "trigger→consequence", "consequence→final payoff"], "payoff": "how the final question pays it off" },',
    '  "intro": ["8-10 lines"],',
    '  "bridge": [],',
    '  "background": ["2-4 lines"],',
    '  "act1": { "lines": ["1-3 transition lines"], "prompt": "question", "options": [',
    '    { "text": "option A", "feedback": ["1-2 lines"] },',
    '    { "text": "option B", "feedback": ["1-2 lines"] },',
    '    { "text": "option C", "feedback": ["1-2 lines"] }',
    '  ] },',
    '  "act2": { "lines": ["2-4 transition lines"], "prompt": "question", "options": [',
    '    { "text": "option A", "feedback": ["1-2 lines"] },',
    '    { "text": "option B", "feedback": ["1-2 lines"] },',
    '    { "text": "option C", "feedback": ["1-2 lines"] }',
    '  ] },',
    '  "branches": { "A": ["2-4 lines"], "B": ["2-4 lines"], "C": ["2-4 lines"] },',
    '  "act3": { "lines": ["2-4 transition lines"], "prompt": "question", "options": [',
    '    { "text": "option A", "feedback": ["1-2 lines"] },',
    '    { "text": "option B", "feedback": ["1-2 lines"] },',
    '    { "text": "option C", "feedback": ["1-2 lines"] }',
    '  ] },',
    '  "final": { "lines": ["2-4 closing lines"], "prompt": "open question", "options": [',
    '    { "text": "option A", "feedback": ["1-2 lines"] },',
    '    { "text": "option B", "feedback": ["1-2 lines"] },',
    '    { "text": "option C", "feedback": ["1-2 lines"] },',
    '    { "text": "option D", "feedback": ["1-2 lines"] }',
    '  ] }',
    '}',
    'Output the JSON now.'
  ].filter(Boolean).join('\n');
}

function buildDialoguePrompt(dimension, address, context, nonce, lang, sceneVariant){
  if(lang !== 'zh-CN' && lang !== 'zh-TW'){
    return buildDialoguePromptEnglish(dimension, address, context, nonce, lang, sceneVariant);
  }
  const b = DIALOGUE_BLUEPRINTS[dimension];
  if(!b) return null;
  const v = sceneVariant && sceneVariant.zh ? sceneVariant.zh : null;
  const sceneText = (v && v.scene) || b.scene;
  const linkText = (v && v.link) || b.link;
  const backgroundText = (v && v.background) || b.background;
  const metaphorText = (v && v.metaphor) || b.metaphor;
  const logicText = b.logic;
  const variantId = (sceneVariant && sceneVariant.id) || (dimension + '-base');
  const c = context || {};
  const stateText = c.dimensionState === 'danger' ? '危险/未坍缩' : c.dimensionState === 'good' ? '良好/方向清晰' : '叠加/方向未定';
  const ratios = c.ratios && typeof c.ratios === 'object'
    ? Object.keys(c.ratios).slice(0, 6).map(k => dialogueSafeText(k, 8) + '=' + (Number(c.ratios[k]) || 0) + '%').join(' / ')
    : '';
  const addressText = dialogueSafeText(address, 20) || '你';
  const stateMode = c.dimensionState === 'danger' ? 'danger' : c.dimensionState === 'good' ? 'good' : 'superposition';
  const ratioEntries = Object.keys(c.ratios || {}).map(k => [dialogueSafeText(k, 8), Number(c.ratios[k]) || 0]).sort((a, b) => b[1] - a[1]);
  const leadCode = dialogueSafeText(c.lead, 8) || (ratioEntries[0] ? ratioEntries[0][0] : '');
  const leadRatio = (ratioEntries.find(x => x[0] === leadCode) || ratioEntries[0] || [leadCode, 0])[1];
  const leadText = leadCode ? ((DIALOGUE_SUB_NAMES_ZH[leadCode] || leadCode) + (leadRatio ? '（' + leadRatio + '%）' : '')) : '当前最亮的那一束';
  const stateRadar = stateMode === 'danger'
    ? '【雷达状态】信号中断/丢失，通道里是空的，系统锁不住一个清晰方向。'
    : stateMode === 'good'
      ? '【雷达状态】信号清晰，通讯畅通，所有通道在线，锁定稳定。'
      : '【雷达状态】两个或三个频率同时重叠，有可见干涉和相位漂移，任何一个都还没有坍缩。';
  const errorCodesByState = {
    danger: ['Error 404 Signal Not Found', 'Error 403 Signal Lost', 'Error 502 Echo Lost'],
    good: ['Signal 000 · Locked', 'Signal 200 · Comms Open', 'Signal 101 · Radar Clear'],
    superposition: ['Signal 207 · Two Frequencies', 'Signal 302 · Phase Drift', 'Signal 418 · Interference']
  };
  const errorCode = errorCodesByState[stateMode][Math.floor(Math.random() * errorCodesByState[stateMode].length)];
  const episodeRules = [
    '【清晰动画剧集规则】',
    '- 这是一集四场动画，不是小说、散文诗或情绪片段。用户必须始终知道：我在哪、我这一场想要什么、什么东西在物理上挡着我、每个选项会尝试做什么。',
    '- 一个地点、一个看得见的目标、一个不断升级的问题；第二幕和第三幕不能突然引入无关的新谜团。',
    '- 每一幕都按：看得见的目标 → 具体障碍 → 三种不同的物理行动 → 立刻出现的结果。每一幕结束时，用这个结果自然抛出下一幕的问题。',
    '- 台词短、可演：动作、物件、系统反应、对话。每场最多一个短比喻，而且必须马上落到用户能看见或摸到的东西上。',
    '- 系统是动画里的跟班：实时吐槽、嘴硬、慌、被打脸、犯低级错误；笑点来自设备和系统，绝不嘲笑用户。',
    '- 三个选项必须是三种不同行动和不同代价，不是三种心情或三句换皮。每条反馈都要写出立刻发生的后果，并把下一步交给下一幕。',
    '- 不允许时间跳跃、突然事件或“然后一切都变了”。每个转场都要有用户能指认的物理前因。'
  ].join('\n');
  const introRhythm = stateMode === 'danger'
    ? '写 8-10 句短开场，顺序：——“哔…”→“我正在扫描你的[维度名]雷达…”→本次状态代码→具体雷达读数→“现在通道很安静，这是设备的读数，不是对你的判断”→ “我不会催你”→一句现实共鸣→“那么现在…”→“把中控台关机…放空你的大脑…跟随着文字的指引…”→“想象一下…”。禁止说“我理解你为何会是这种状态”，禁止暗示用户坏掉了、懒、消极或不正常。'
    : stateMode === 'good'
      ? '写 8-10 句短开场，顺序：——“哔…”→“我正在扫描你的[维度名]雷达…”→本次状态代码→清晰稳定的读数→“你的[最强子维度]特别突出，占比[比例]，这是一个真实的优势”→具体夸这个优势，不要泛泛鼓励→“我不是来修你的；我们看看这个优势能走多远”→一句现实共鸣→“那么现在…”→“把中控台关机…放空你的大脑…跟随着文字的指引…”→“想象一下…”。禁止说“我理解你为何会是这种状态”“不过别担心”，禁止暗示用户有任何问题。'
      : '写 8-10 句短开场，顺序：——“哔…”→“我正在扫描你的[维度名]雷达…”→本次状态代码→读出两个或更多真实频率→“两个信号都是真的；同时保留两种可能，不是缺陷”→ “我们不需要现在就让它坍缩”→一句现实共鸣→“那么现在…”→“把中控台关机…放空你的大脑…跟随着文字的指引…”→“想象一下…”。禁止说“我理解你为何会是这种状态”，禁止说用户优柔寡断，禁止暗示叠加态是需要修的毛病。';
  const stateContract = stateMode === 'danger'
    ? [
        '【本维度核心任务：危险/未坍缩态 → 先帮助用户确定方向，不急着给答案】',
        '- 这一颗球信号不稳，方向还没有锁定；剧本的任务不是治疗，也不是劝他振作，而是让他在几个具体方向里感受到哪一条更有能量。不要暗示用户有缺陷；只描述信号和处境。',
        '- 三幕必须分别测试不同的方向，而不是把同一句话换个说法；选项要指向具体方向、具体代价、具体下一步。',
        '- 允许用户先选“不确定/先观察”，但每次选择都要让某个方向变得更清楚一点。',
        '- 终幕只帮他命名“我愿意先往哪边试一步”，不要求长期承诺，不替他做决定。'
      ].join('\n')
    : stateMode === 'good'
      ? [
          '【本维度核心任务：良好/方向清晰态 → 往最强方向推进】',
          '- 这一颗球已经有明确方向；当前最强子维度是 ' + leadText + '。剧本要识别并放大这个优势，而不是重新把所有方向都铺开。必须结合具体占比或证据明确夸这个优势，不要泛泛夸奖。',
          '- 三幕逐级增加挑战：先用优势解决一个小问题 → 让优势遇到真实阻力 → 把优势迁移到更大的场景。',
          '- 选项要体现同一优势的不同用法；不是“你已经很好所以不用动”，而是让优势再往前伸展一格。',
          '- 终幕邀请用户把最强方向变成一个可执行的下一步，但不命令、不替用户决定。'
        ].join('\n')
      : [
          '【本维度核心任务：叠加/方向未定态 → 在叠加里测试，不提前坍缩】',
          '- 这一颗球同时停在多个可能之间；剧本要让两个或多个真实冲动都上场，制造干涉，而不是第一幕就逼他选死。两种冲动都是真实的；不要说用户优柔寡断，也不要把叠加态写成需要修的毛病。',
          '- 三幕结构：两个可能同时成立 → 选择产生干涉/代价 → 一次不杀死另一边的小测量。',
          '- 选项必须包含“同时保留 / 先试一点 / 退一步观察”等不同策略，让用户经验到叠加本身的张力。',
          '- 分支要保留两种可能留下的痕迹；终幕帮助他观察哪一边更相干，而不是替他选边。'
        ].join('\n');
  const stateActs = stateMode === 'danger'
    ? [
        '第一幕：雷达断续，场景里出现三条不同的方向线索；用户选择先靠近哪一条，选择暴露他真正想保护/想争取的东西',
        '第二幕：选择带来具体后果，另一条方向以干扰的形式出现；用户决定继续、换线还是停一下',
        '第三幕：一个小实验，让用户用行动测试方向；代价/线索回收第一幕的前兆',
        '终幕：如果只能带走一个方向，他愿意先试哪一步；选项指向不同方向，不逼长期承诺'
      ]
    : stateMode === 'good'
      ? [
          '第一幕：信号锁定，场景给出一个能发挥 ' + leadText + ' 的具体挑战；用户选择怎么用优势',
          '第二幕：优势遇到真实阻力或代价，要求升级而不是退回；用户选择升级方式',
          '第三幕：把优势迁移到更大的场景，回收第一幕的前兆；用户选择伸展边界',
          '终幕：把最强方向往前推一步的邀请；选项是不同形态的下一步，不是泛泛的人生道理'
        ]
      : [
          '第一幕：两个真实冲动同时出现在场景里；用户选择先容纳/观察哪一个，不要求立刻二选一',
          '第二幕：两个方向发生干涉，出现第三种图案或代价；用户选择如何在不杀死另一边的情况下继续',
          '第三幕：一次小测量，让叠加态显影但不彻底坍缩；回收第一幕的前兆',
          '终幕：哪一边的相干更强、更想被看见；选项保留两种可能的余地，不替用户选边'
        ];
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
  const variantList = DIALOGUE_VARIANTS[dimension] || [b.causal];
  const variant = variantList[Math.floor(Math.random() * variantList.length)];
  return [
    '你是 QBTI 的量子态系统，第一人称是“我”，用户是“你”。',
    '【输出语言】必须全程使用 ' + (DIALOGUE_LANG_NAMES[lang] || '简体中文') + '。intro、bridge、background、选项、反馈、终幕全部使用该语言；JSON 的字段名保持英文。' + (lang === 'zh-TW' ? '不要使用简体中文。' : (lang !== 'zh-CN' ? '不要输出中文。' : '')),
    '你正在和用户进行一场沉浸式维度对话。',
    '【本维度剧本设定】',
    '维度：' + b.name,
    '场景：' + sceneText,
    '雷达信号接入点：' + linkText,
    '本维度背景信息：' + backgroundText,
    '核心隐喻：' + metaphorText,
    '禁止：' + b.forbidden,
    '因果铺垫：' + logicText,
    '【本次场景变体】' + variantId + '——把它当成全新的一集，不是改写样例；必须创造至少三个背景里没有的具体细节，不能复用上一集的场景名、第一个物件、第一个动作或开场句。',
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
    '- 危险态出现“Error”字样；良好态/叠加态出现“Signal/Status”字样，不使用“Error”。本次状态匹配代码必须逐字使用：' + errorCode,
    '- 出现“扫描 / 探测 / 雷达”中的至少一个词',
    '- 用“我”作为探测主体',
    stateRadar,
    '- “丢失/微弱/卡住/中断”只能描述通道和设备，不能描述用户；不得诊断、贬低或暗示用户有缺陷。良好态必须点名并具体夸最强子维度及其占比；叠加态必须明确说两种信号都真实、同时存在不是缺陷。',
    '- 良好态和叠加态禁止写“No Found / 404 / 信号丢失”；良好态要明确写“信号清晰、通讯畅通、锁定稳定”，叠加态要明确写“双频/多频重叠、干涉、相位漂移”。危险态才可以使用丢失/404。',
    '- 错误码和开场现象每次必须有新意，但不能改变状态对应的雷达结论',
    '- 这个雷达异常不能只是装饰：它要成为第一幕第一个前兆的原因或伏笔',
    '- 必须明确读出用户当前状态：危险态是信号断续/丢失，良好态是信号稳定/锁定，叠加态是双频/漂移',
    '',
    '【引入节奏：模仿这段呼吸，不要直接切场景】',
    introRhythm,
    '必须原样或近似出现“放空你的大脑”“跟随着文字的指引”“想象一下”这三个关键动作，不能省略',
    '【不指责原则】雷达描述的是通道、设备和信号，不是用户的价值或人格；禁止说用户坏掉了、懒、消极、不正常，禁止用“你有问题/你状态不好”作为开场。',
    '',
    '【雷达 → 剧本的衔接】',
    '- 不要报完 Error 就直接切到场景',
    '- 先让“我”读出雷达检测到的用户状态',
    '- 如果 intro 以“想象一下…”自然进入场景，就不需要强行写技术 bridge；此时 bridge 必须是空数组 []',
    '- 如果不用想象式过渡，才写 1-3 句 bridge，把异常信号接入/投影到：' + linkText,
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
    stateContract,
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
    '【因果过渡】',
    '- 按前面的状态专属四幕结构执行；每一幕都必须有前兆 → 触发 → 后果。',
    '- 危险态每一幕测试不同方向；叠加态保留多种可能；良好态围绕最强子维度逐级加码。',
    '',
    '【活力：像现场直播，不像报告】',
    '- 系统要有实时反应：等等、不是吧、我再看一眼、我这边信号在抖',
    '- 每个选择先改变一个具体东西：灯、灰、声音、位置、温度、压力，再谈感受',
    '- 允许系统说错再改口，允许短句、打断、停顿',
    '- 不要连续四句都以“你”开头，不要每段都总结升华',
    '- 每份剧本至少有两个具体的声音或触感细节',
    '',
    '【四幕结构：必须按当前维度状态执行】',
    ...stateActs,
    '',
    '请写一个完整的四幕选择剧本，总字数 1000-1300 字。',
    '只输出合法 JSON，不要 markdown、代码块或解释。结构：',
    '{',
    '  "continuity": { "openingDetail": "开场埋下的一个细节", "causeChain": ["前兆→触发", "触发→后果", "后果→终幕回收"], "payoff": "终幕如何回收这个细节" },',
    '  "intro": ["8-10句开场：雷达扫描→状态代码（危险 Error / 良好或叠加 Signal）→状态观察→安抚→理解→现实共鸣→那么现在→放空大脑→想象一下"],',
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
  try {
  const featureFlags = await readFeatureFlags();
  if(!featureFlags.story) return res.status(403).json({ error: '剧情功能已被管理员关闭', code: 'FEATURE_DISABLED' });
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
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || 'unknown').trim();
  const variant = chooseDialogueVariant(dimension, ip);
  const prompt = buildDialoguePrompt(dimension, address, safeContext, nonce, lang, variant);
  if(!prompt || prompt.length > 20000) return res.status(500).json({ error: '提示词生成失败' });
  res.json({ success: true, dimension: dimension, scenarioId: variant ? variant.id : null, prompt: prompt });
  } catch(err){
    console.error('[剧本提示词] 生成失败:', err && err.message ? err.message : err);
    if(!res.headersSent) res.status(500).json({ error: '剧本提示词生成失败', code: 'PROMPT_FAILED' });
  }
});

// 4.8.4 量子态状况（第五维度前的小球观测，确定性分析，不消耗 AI Token）
app.post('/api/quantum/status', async (req, res) => {
  const featureFlags = await readFeatureFlags();
  if(!featureFlags.explanation) return res.status(403).json({ error: '量子态解释已被管理员关闭', code: 'FEATURE_DISABLED' });
  const body = req.body || {};
  const dim = String(body.dimension || '').toUpperCase();
  const dims = { PO: ['X', 'C', 'A'], II: ['P', 'M', 'I'], LA: ['I', 'D', 'E'], UR: ['T', 'H', 'R'] };
  if(!dims[dim]) return res.status(400).json({ error: '维度不正确' });
  const type = ['good', 'danger', 'superposition'].includes(body.type) ? body.type : 'superposition';
  const input = body.scores && typeof body.scores === 'object' ? body.scores : {};
  const scores = {};
  dims[dim].forEach(k => { scores[k] = Math.max(0, Math.min(100, Number(input[k]) || 0)); });
  const values = Object.values(scores);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const spread = max - min;

  let position = 1 + avg / 25;
  if(type === 'good') position += 0.18;
  if(type === 'danger') position -= 0.18;
  if(spread > 45) position -= 0.22;
  if(min < 25) position -= 0.20;
  position = Math.max(1.05, Math.min(4.95, position));
  const ladder = Math.max(1, Math.min(5, Math.round(position)));
  const next = Math.min(5, ladder + 1);

  const guidance = type === 'good'
    ? 'clear'
    : type === 'danger'
      ? 'blocked'
      : (avg >= 50 ? 'forming' : 'weak');

  const stability = spread < 20 ? 'high' : spread < 36 ? 'medium' : 'low';
  res.json({
    success: true,
    version: 'quantum-status-v1',
    dimension: dim,
    type: type,
    ladder: ladder,
    ladderPosition: Math.round(position * 10) / 10,
    nextLadder: next,
    guidance: guidance,
    stability: stability,
    avg: Math.round(avg * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    spread: Math.round(spread * 10) / 10,
    scores: scores
  });
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

// 4.8.1 全服功能开关（公开只读）
app.get('/api/features', async (req, res) => {
  try { res.json({ success: true, features: await readFeatureFlags() }); }
  catch(e){ res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' }); }
});

// 4.8.2 当前账号状态（用于黑名单拦截）
app.get('/api/student/account-status', async (req, res) => {
  const email = await resolveSessionEmailAllowBanned(req);
  if(!email) return res.status(401).json({ error: '登录已过期', code: 'SYNC_AUTH' });
  try {
    const banned = await isStudentBanned(email);
    let reason = '';
    if(banned){
      const r = await pool.query('SELECT reason FROM student_bans WHERE LOWER(email) = $1', [String(email).toLowerCase()]);
      reason = r.rows[0] ? String(r.rows[0].reason || '') : '';
    }
    res.json({ success: true, authenticated: true, email: email, banned: banned, reason: reason, features: await readFeatureFlags() });
  } catch(e){ res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' }); }
});

// 4.8.3 管理员：全服功能开关
app.get('/api/admin/features', requireStudentAdmin, async (req, res) => {
  try { res.json({ success: true, features: await readFeatureFlags() }); }
  catch(e){ res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' }); }
});
app.post('/api/admin/features', requireStudentAdmin, async (req, res) => {
  try {
    const features = await writeFeatureFlags(req.body || {}, 'Administrator');
    res.json({ success: true, features: features });
  } catch(e){
    console.error('[全服开关] 保存失败:', e.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.8.35 管理员：查看所有用户历史观测
app.get('/api/admin/history', requireStudentAdmin, async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 100);
  const pattern = '%' + search + '%';
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
  const offset = Math.max(0, Math.min(100000, Number(req.query.offset) || 0));
  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM quiz_records q
       LEFT JOIN student_emails se ON LOWER(se.email) = LOWER(q."studentEmail")
       WHERE ($1 = '' OR q."studentEmail" ILIKE $2 OR COALESCE(se.username,'') ILIKE $2)`,
      [search, pattern]
    );
    const r = await pool.query(
      `SELECT q."studentEmail", q."quizTs", q.payload, q."createdAt", se.username
       FROM quiz_records q
       LEFT JOIN student_emails se ON LOWER(se.email) = LOWER(q."studentEmail")
       WHERE ($1 = '' OR q."studentEmail" ILIKE $2 OR COALESCE(se.username,'') ILIKE $2)
       ORDER BY q."quizTs" DESC
       LIMIT $3 OFFSET $4`,
      [search, pattern, limit, offset]
    );
    res.json({
      success: true,
      total: countRes.rows[0] ? countRes.rows[0].total : 0,
      limit: limit,
      offset: offset,
      records: r.rows.map(function(row){
        return {
          email: row.studentEmail,
          username: row.username || '',
          ts: Number(row.quizTs) || 0,
          updatedAt: Number(row.createdAt) || 0,
          payload: row.payload || null
        };
      })
    });
  } catch(e){
    console.error('[管理员全部历史] 读取失败:', e.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

// 4.8.4 管理员：用户列表 / 黑名单
app.get('/api/admin/student-account/:email', requireStudentAdmin, async (req, res) => {
  const email = String(req.params.email || '').toLowerCase().trim();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return res.status(400).json({ error: '邮箱格式不正确', code: 'BAD_REQUEST' });
  }
  try {
    const [accRes, bindRes, histRes, repRes, setRes, banRes] = await Promise.all([
      pool.query('SELECT email, username, phone, "createdAt" FROM student_emails WHERE LOWER(email) = $1', [email]),
      pool.query(
        `SELECT b."parentEmail", b."boundAt", p.username AS "parentUsername"
         FROM bindings b LEFT JOIN parents p ON LOWER(p.email) = LOWER(b."parentEmail")
         WHERE LOWER(b."studentEmail") = $1 ORDER BY b."boundAt" DESC`,
        [email]
      ),
      pool.query(
        `SELECT "quizTs", payload FROM quiz_records WHERE LOWER("studentEmail") = $1 ORDER BY "quizTs" DESC LIMIT 500`,
        [email]
      ),
      pool.query('SELECT payload, "updatedAt" FROM reports WHERE LOWER("studentEmail") = $1', [email]),
      pool.query('SELECT settings, "updatedAt" FROM account_settings WHERE LOWER("studentEmail") = $1', [email]),
      pool.query('SELECT reason, "bannedAt" FROM student_bans WHERE LOWER(email) = $1', [email])
    ]);
    const acc = accRes.rows[0];
    if(!acc) return res.status(404).json({ error: '学生账户不存在', code: 'NOT_FOUND' });
    const ban = banRes.rows[0];
    const rep = repRes.rows[0];
    const settings = setRes.rows[0];
    res.json({
      success: true,
      account: {
        email: acc.email,
        username: acc.username || '',
        phone: acc.phone || '',
        createdAt: Number(acc.createdAt) || null
      },
      banned: !!ban,
      banReason: ban ? (ban.reason || '') : '',
      bannedAt: ban ? Number(ban.bannedAt) || null : null,
      bindings: bindRes.rows.map(b => ({
        parentEmail: b.parentEmail,
        parentUsername: b.parentUsername || '',
        boundAt: Number(b.boundAt) || null
      })),
      report: rep ? { payload: rep.payload || null, updatedAt: Number(rep.updatedAt) || null } : null,
      settings: settings ? { settings: settings.settings || {}, updatedAt: Number(settings.updatedAt) || null } : null,
      history: histRes.rows.map(h => ({
        ts: Number(h.quizTs) || 0,
        payload: h.payload || null
      }))
    });
  } catch(e){
    console.error('[管理员学生账户详情] 失败:', e.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

app.get('/api/admin/users', requireStudentAdmin, async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 100);
  const pattern = '%' + search + '%';
  try {
    const r = await pool.query(
      `SELECT se.email, se.username, se.phone, se."createdAt",
              CASE WHEN b.email IS NULL THEN FALSE ELSE TRUE END AS banned,
              b.reason, b."bannedAt"
       FROM student_emails se
       LEFT JOIN student_bans b ON LOWER(b.email) = LOWER(se.email)
       WHERE ($1 = '' OR se.email ILIKE $2 OR COALESCE(se.username,'') ILIKE $2)
       ORDER BY se."createdAt" DESC NULLS LAST
       LIMIT 1000`,
      [search, pattern]
    );
    res.json({ success: true, users: r.rows.map(u => ({
      email: u.email, username: u.username || '', phone: u.phone || '',
      createdAt: Number(u.createdAt) || null, banned: !!u.banned,
      reason: u.reason || '', bannedAt: Number(u.bannedAt) || null
    })) });
  } catch(e){
    console.error('[用户列表] 失败:', e.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});
app.post('/api/admin/users/:email/ban', requireStudentAdmin, async (req, res) => {
  const email = String(req.params.email || '').toLowerCase().trim();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return res.status(400).json({ error: '邮箱格式不正确', code: 'BAD_REQUEST' });
  }
  if(email === 'administrator@qbti.local'){
    return res.status(400).json({ error: '不能禁用管理员账号', code: 'BAD_REQUEST' });
  }
  const banned = req.body && req.body.banned !== false;
  const reason = String((req.body && req.body.reason) || '').trim().slice(0, 200);
  try {
    if(banned){
      const u = await pool.query('SELECT username FROM student_emails WHERE LOWER(email) = $1', [email]);
      const username = u.rows[0] ? String(u.rows[0].username || '') : '';
      await pool.query(
        `INSERT INTO student_bans (email, username, reason, "bannedAt", "updatedBy")
         VALUES ($1, $2, $3, $4, 'Administrator')
         ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, reason = EXCLUDED.reason, "bannedAt" = EXCLUDED."bannedAt", "updatedBy" = 'Administrator'`,
        [email, username, reason, Date.now()]
      );
    } else {
      await pool.query('DELETE FROM student_bans WHERE LOWER(email) = $1', [email]);
    }
    res.json({ success: true, email: email, banned: banned, reason: reason });
  } catch(e){
    console.error('[黑名单] 保存失败:', e.message);
    res.status(500).json({ error: '服务器数据库异常', code: 'DB_ERROR' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const purpose = String(req.headers['x-qbti-purpose'] || '').trim();
  if(purpose === 'story' || purpose === 'report' || purpose === 'explanation'){
    const flags = await readFeatureFlags();
    if(!flags[purpose]) return res.status(403).json({ error: '该功能已被管理员关闭', code: 'FEATURE_DISABLED' });
  }
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
  if(!prompt || prompt.length > 20000) return res.status(400).json({ error: '提示词为空或过长' });
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

// 4.8.6 维度物理观测日志（AI 个性化，展开时才生成）
const quantumLogCache = new Map();
const quantumLogHits = new Map();
const QLOG_BURST_WINDOW_MS = 10 * 1000;
const QLOG_BURST_TOKEN_LIMIT = 20000;
const QLOG_BURST_LOCK_MS = 10 * 60 * 1000;
function qlogBurstState(ip){
  const now = Date.now();
  let slot = quantumLogHits.get(ip);
  if(!slot){ slot = { events: [], lockedUntil: 0 }; quantumLogHits.set(ip, slot); }
  slot.events = (slot.events || []).filter(e => e && e.ts > now - QLOG_BURST_WINDOW_MS);
  const tokens = slot.events.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  return { locked: slot.lockedUntil > now || tokens >= QLOG_BURST_TOKEN_LIMIT, tokens: tokens, lockedUntil: slot.lockedUntil || 0 };
}
function qlogRecordTokens(ip, tokens){
  const now = Date.now();
  let slot = quantumLogHits.get(ip);
  if(!slot){ slot = { events: [], lockedUntil: 0 }; quantumLogHits.set(ip, slot); }
  slot.events = (slot.events || []).filter(e => e && e.ts > now - QLOG_BURST_WINDOW_MS);
  const n = Math.max(0, Number(tokens) || 0);
  if(n > 0) slot.events.push({ ts: now, tokens: n });
  const total = slot.events.reduce((sum, e) => sum + (Number(e.tokens) || 0), 0);
  if(total >= QLOG_BURST_TOKEN_LIMIT) slot.lockedUntil = now + QLOG_BURST_LOCK_MS;
  return qlogBurstState(ip);
}
const QLOG_PHYSICS_ZH = {
  PO: {
    danger: '基态 / 量子反射 / 势垒：低能量不等于没有能量，新刺激需要吸收一份量子才能跃迁；反射是自我保护。',
    good: '激发态 / 自发辐射 / 低势垒：对外界高敏，吸收光子后会把热情发散出去；高能级也容易耗散。',
    superposition: '基态与激发态的叠加 / 干涉：门内和门外同时存在，尚未被观测锁定；不要提前坍缩。'
  },
  II: {
    danger: '退相干 / 热力学死寂 / 隧穿：曾经共振的事情失去相位，行动缺少反馈；用最小能量穿过必须完成的任务。',
    good: '超导态 / 量子纠缠 / 同频共振：找到目标后进入低电阻状态，和问题彼此牵连；注意能量燃烧。',
    superposition: '纠缠与退相干的叠加 / 相位漂移：既想投入又想抽离，两种频率同时存在；先观察干涉。'
  },
  LA: {
    danger: '观测者效应 / 静摩擦 / 薛定谔的任务：没有外部观测者时波函数弥散，启动需要很大能量；任务停在做了和没做之间。',
    good: '内部观测者 / 势能 / 量子隧穿：能自己维持波函数稳定，把阻力转成势能，遇到硬墙会找低耗能路径。',
    superposition: '自我观测与外部观测的叠加 / 概率云：自主和等待指令同时存在，观测方式决定它往哪边聚拢。'
  },
  UR: {
    danger: '未观测恐惧 / 概率深渊 / 强制坍缩：害怕未知，提前把结果坍缩成最坏版本；确定性痛苦换取安全感。',
    good: '绝对不确定性 / 量子韧性 / 能级跃迁：把风险当成碰撞实验，受撞后反而跳到更高能级；注意低熵休息。',
    superposition: '概率云 / 未坍缩 / 多种结果并存：既想冲进去又想退一步，未知还没有被强行观测；保留模糊。'
  }
};
const QLOG_PHYSICS_EN = {
  PO: {
    danger: 'ground state / quantum reflection / barrier: low energy is not no energy; a new stimulus needs one quantum to jump, and reflection protects the system.',
    good: 'excited state / spontaneous emission / low barrier: high sensitivity, absorbs photons and radiates enthusiasm; high levels also dissipate.',
    superposition: 'ground-excited superposition / interference: inside and outside the door coexist; do not collapse it early.'
  },
  II: {
    danger: 'decoherence / thermodynamic stillness / tunneling: old resonance loses phase and action lacks feedback; minimum energy through required tasks.',
    good: 'superconducting state / entanglement / resonance: a low-resistance sprint when a goal resonates; watch for burning out.',
    superposition: 'entanglement-decoherence superposition / phase drift: wanting to invest and withdraw at once; observe the interference.'
  },
  LA: {
    danger: 'observer effect / static friction / Schrödinger task: without an external observer the wavefunction spreads; starting costs energy; the task sits between done and not done.',
    good: 'internal observer / potential energy / tunneling: sustains its own wavefunction, converts resistance into potential, finds low-energy paths.',
    superposition: 'self-observation vs external observation / probability cloud: autonomy and waiting-for-instructions coexist; observation decides where it gathers.'
  },
  UR: {
    danger: 'fear of the unobserved / probability abyss / forced collapse: collapses to the worst outcome early; certain pain buys safety.',
    good: 'absolute uncertainty / quantum resilience / level jump: treats risk as a collision experiment; after impact it jumps higher; needs low-entropy rest.',
    superposition: 'probability cloud / uncollapsed / many outcomes: wanting to enter and step back; keep the ambiguity alive.'
  }
};
function qlogSafe(v, max){ return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, max || 200); }
function qlogPrompt(body, lang){
  const dim = body.dimension;
  const state = body.type;
  const zh = String(lang).indexOf('zh') === 0;
  const target = zh ? (lang === 'zh-TW' ? '繁體中文' : '简体中文') : (DIALOGUE_LANG_NAMES[lang] || 'English');
  const lens = (zh ? QLOG_PHYSICS_ZH : QLOG_PHYSICS_EN)[dim][state];
  const scores = body.scores && typeof body.scores === 'object' ? Object.keys(body.scores).slice(0, 6).map(k => k + '=' + (Number(body.scores[k]) || 0)).join(' / ') : '';
  const lead = qlogSafe(body.lead, 8);
  const gap = Number(body.gap) || 0;
  const ratios = body.ratios && typeof body.ratios === 'object' ? Object.keys(body.ratios).slice(0, 6).map(k => k + '=' + (Number(body.ratios[k]) || 0) + '%').join(' / ') : '';
  if(zh){
    return [
      '你是一座量子观测站的导航日志撰写者，不是心理测评报告。',
      '输出语言：' + target + '。全部内容使用该语言；JSON 字段名保持英文；不要输出中文（简体中文/繁体中文目标除外）。',
      '用户维度：' + dim + '；当前维度状态：' + state + '（danger=危险/未坍缩，superposition=叠加/未定，good=良好/方向清晰）。',
      '用户数据：子维度分数 ' + (scores || '未知') + '；内部占比 ' + (ratios || '未知') + '；主导子维度 ' + (lead || '未知') + '；差值 ' + gap + '%。',
      '物理透镜（可以使用，但必须根据用户数据重新组织，不能逐字照抄）：' + lens,
      '状态规则：danger 要先帮助用户看见方向，不急着给答案；superposition 必须保留两种以上可能、写出干涉/相位/未坍缩，不要第一段就逼用户选边；good 要围绕最强子维度放大优势，并说明高能级的耗散风险。',
      '写四段，且只写四段：',
      'energy（能级观测）：描述当前能量状态（基态/激发态/超导态/退相干/叠加等），解释为什么现在是这个样子。',
      'barrier（势垒描述）：点出当前真实阻力；不需要克服，先允许它存在。',
      'behavior（量子行为）：描述这个状态下独特的生存策略（反射/隧穿/纠缠/自发辐射等），要具体到用户的数据。',
      'leap（跃迁引导）：开放、非说教的温柔邀请；不是建议，不是命令，不替用户决定。',
      '红线：不定义用户、不贴人格标签、不诊断、不评价好坏；不写“你应该/你必须/你需要/建议你”；不出现家长、老师、AI、模型、分数、报告；不写“突然”；不使用空洞鸡汤。',
      '内容要全面、具体，不设字数上限；每段至少 4-6 句并充分展开，但不要为了凑字数重复或灌水。',
      '必须引用用户的具体分数、内部占比、主导子维度和差值，解释这些数据如何导致当前状态；至少给出两个日常表现例子，避免只堆量子名词。',
      'energy 要写：状态名称 + 为什么 + 日常表现 + 这个状态在保护什么；barrier 要写：外部/内部阻力 + 为什么存在 + 用户如何感知 + 允许它存在；behavior 要写：策略如何运作 + 代价 + 它带来了什么；leap 要写：一个很小、可选的实验或邀请 + 不要求结果。',
      '只输出合法 JSON，不要 markdown，不要代码块。结构：{"energy":"...","barrier":"...","behavior":"...","leap":"..."}'
    ].join('\n');
  }
  return [
    'You write navigation logs for a quantum observation station. This is not a psychological assessment report.',
    'OUTPUT LANGUAGE: ' + target + '. Write every value in that language; keep JSON keys in English; do not write Chinese unless the target is Chinese.',
    'Dimension: ' + dim + '; state: ' + state + ' (danger = not yet collapsed, superposition = undecided, good = clear direction).',
    'User data: subdimension scores ' + (scores || 'unknown') + '; internal ratios ' + (ratios || 'unknown') + '; leading subdimension ' + (lead || 'unknown') + '; gap ' + gap + '%.',
    'Physics lens (use it, but rewrite for this user; do not copy verbatim): ' + lens,
    'State rules: danger should help the user see a direction without rushing an answer; superposition must keep two or more possibilities alive with interference/phase/uncollapsed language and must not force a choice in the first paragraph; good should amplify the strongest subdimension and name the dissipation risk of high energy.',
    'Write exactly four sections:',
    'energy: the current energy state (ground/excited/superconducting/decoherent/superposition) and why it is like this now.',
    'barrier: the real current resistance; it does not need to be overcome, allow it to exist first.',
    'behavior: this state’s distinctive survival strategy (reflection/tunneling/entanglement/spontaneous emission), grounded in the user data.',
    'leap: an open, non-preachy, gentle invitation; not advice, not a command, not a decision for the user.',
    'Rules: do not define, label, diagnose or judge; do not use "you should", "you must", "you need to", "I suggest"; do not mention parents, teachers, AI, models, scores or reports; no sudden events; no empty motivational talk.',
    'Be comprehensive and specific, not abstract. There is no upper word limit; each section should have at least 4-6 sentences and be fully developed, but do not repeat or pad just to add length.',
    'Cite the user’s specific scores, internal ratios, leading subdimension and gap, and explain how those data produce the current state. Give at least two everyday examples; do not just pile up quantum vocabulary.',
    'energy: name the state + why + everyday signs + what the state protects; barrier: external/internal resistance + why it exists + how the user feels it + allow it; behavior: how the strategy works + its cost + what it gives; leap: one tiny optional experiment or invitation + no required outcome.',
    'Output valid JSON only, no markdown, no code fence. Schema: {"energy":"...","barrier":"...","behavior":"...","leap":"..."}'
  ].join('\n');
}
function qlogParse(content){
  let text = String(content || '').trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if(start >= 0 && end > start) text = text.slice(start, end + 1);
  let obj;
  try { obj = JSON.parse(text); } catch(e){ return null; }
  const out = {};
  ['energy', 'barrier', 'behavior', 'leap'].forEach(k => {
    const v = obj && obj[k];
    if(typeof v !== 'string' || v.trim().length < 8) throw new Error('invalid section');
    out[k] = v.trim();
  });
  return out;
}

app.post('/api/quantum/log', async (req, res) => {
  const featureFlags = await readFeatureFlags();
  if(!featureFlags.explanation) return res.status(403).json({ error: '量子态解释已被管理员关闭', code: 'FEATURE_DISABLED' });
  const body = req.body || {};
  const dim = String(body.dimension || '').toUpperCase();
  const dims = { PO: ['X','C','A'], II: ['P','M','I'], LA: ['I','D','E'], UR: ['T','H','R'] };
  if(!dims[dim]) return res.status(400).json({ error: '维度不正确' });
  const type = ['good','danger','superposition'].includes(body.type) ? body.type : 'superposition';
  const lang = DIALOGUE_LANG_NAMES[body.lang] ? body.lang : 'zh-CN';
  const safe = {
    dimension: dim, type: type, lang: lang,
    scores: {}, ratios: {}, lead: qlogSafe(body.lead, 8), gap: Math.max(0, Math.min(100, Number(body.gap) || 0))
  };
  dims[dim].forEach(k => {
    safe.scores[k] = Math.max(0, Math.min(100, Number(body.scores && body.scores[k]) || 0));
    if(body.ratios && body.ratios[k] != null) safe.ratios[k] = Math.max(0, Math.min(100, Number(body.ratios[k]) || 0));
  });
  const cacheKey = 'qlog-v2|' + JSON.stringify(safe);
  if(quantumLogCache.has(cacheKey)){
    const hit = quantumLogCache.get(cacheKey);
    return res.json({ success: true, source: 'cache', dimension: dim, state: type, log: hit });
  }
  if(qlogBurstState('global').locked){
    return res.status(429).json({ error: '观测站信号暂时中断', code: 'TOKEN_BURST' });
  }
  const cfg = await readAIConfig();
  if(!cfg || !cfg.enabled || !cfg.key) return res.status(503).json({ error: '观测站尚未接入 AI', code: 'NO_AI_CONFIG' });
  const prompt = qlogPrompt(safe, lang);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const upstream = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a quantum observation station log writer. Output strict JSON only. Never diagnose, label or command the user.' },
          { role: 'user', content: prompt }
        ],
        temperature: Math.min(1.05, Math.max(.4, Number(cfg.temperature) || .85)),
        stream: false
      })
    });
    if(!upstream.ok){
      const txt = await upstream.text().catch(() => '');
      console.warn('[量子日志] upstream', upstream.status, txt.slice(0, 120));
      return res.status(502).json({ error: '观测站信号中断', code: 'AI_BAD_RESPONSE' });
    }
    const data = await upstream.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const usage = (data && data.usage) || {};
    const usedTokens = Number(usage.total_tokens) || Math.ceil((prompt.length + String(content || '').length) / 2);
    const burst = qlogRecordTokens('global', usedTokens);
    if(burst.locked){
      return res.status(429).json({ error: '观测站信号暂时中断', code: 'TOKEN_BURST' });
    }
    const log = qlogParse(content);
    if(!log) return res.status(502).json({ error: '观测站返回格式异常', code: 'AI_BAD_JSON' });
    quantumLogCache.set(cacheKey, log);
    if(quantumLogCache.size > 300){
      const first = quantumLogCache.keys().next().value;
      if(first) quantumLogCache.delete(first);
    }
    res.json({ success: true, source: 'ai', dimension: dim, state: type, log: log });
  } catch (err){
    console.warn('[量子日志] failed', err.message);
    res.status(502).json({ error: '观测站信号中断', code: 'AI_LOG_FAILED' });
  } finally {
    clearTimeout(timer);
  }
});

// 4.9 跨设备同步：历史问卷
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
  if(await isStudentBanned(se)) return res.status(403).json({ error: '该账号已被管理员禁用', code: 'USER_BANNED' });
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
let serverStarted = false;
function startHttpServer(){
  if(serverStarted) return;
  serverStarted = true;
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
}
/* 先监听端口，避免 Render 健康检查/登录请求在数据库初始化期间收到 502 */
startHttpServer();
initDB().catch(err => {
  console.error('⚠️ 数据库初始化失败，HTTP 服务保持运行:', err && err.message ? err.message : err);
});

process.on('unhandledRejection', err => {
  console.error('[未处理的 Promise 拒绝]', err && err.stack ? err.stack : err);
});
process.on('uncaughtException', err => {
  console.error('[未捕获异常]', err && err.stack ? err.stack : err);
});