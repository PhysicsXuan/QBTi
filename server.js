/* ============================================================
   QBTI 本地验证码服务器
   - 提供静态文件服务（index.html / qbti-core.js 等）
   - 提供 /api/send-code 和 /api/verify-code
   - 读取 .env 中的 SMTP 配置，真实发送邮件
   ============================================================ */

require('dotenv').config();

const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* ---------- 内存存储验证码 ---------- */
const codeStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now && (now - val.lastSentAt) > 10 * 60 * 1000) {
      codeStore.delete(key);
    }
  }
}, 60 * 1000);

/* ---------- 邮件服务 ---------- */
let mailer = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  mailer.verify((err) => {
    if (err) {
      console.error('');
      console.error('❌ SMTP 连接失败:', err.message);
      console.error('   请检查 .env 中的 SMTP_USER / SMTP_PASS 是否正确');
      console.error('   SMTP_PASS 必须是授权码，不是 QQ 密码');
      console.error('');
      mailer = null;
    } else {
      console.log('✅ SMTP 连接成功，将真实发送邮件到', process.env.SMTP_USER);
    }
  });
} else {
  console.log('⚠️  未配置 SMTP，验证码将打印在控制台');
}

/* ---------- 发送验证码 ---------- */
app.post('/api/send-code', async (req, res) => {
  const { email, phone } = req.body || {};
  const target = email ? 'email:' + email.toLowerCase().trim() :
                 phone ? 'phone:' + phone.trim() : null;

  if (!target) return res.status(400).json({ error: '缺少邮箱或手机号' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }

  const now = Date.now();
  const existing = codeStore.get(target);
  if (existing && (now - existing.lastSentAt) < 60 * 1000) {
    const wait = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: '请 ' + wait + ' 秒后再试' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  codeStore.set(target, {
    code: code,
    expiresAt: now + 5 * 60 * 1000,
    attempts: 0,
    lastSentAt: now,
  });

  console.log('');
  console.log('========================================');
  console.log('  [验证码] ' + target);
  console.log('  验证码：' + code + '  （5 分钟内有效）');
  console.log('========================================');
  console.log('');

  if (email && mailer) {
    try {
      await mailer.sendMail({
        from: '"QBTI" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: '【QBTI】你的验证码',
        html: [
          '<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0B0D1C;color:#E9EBFF;border-radius:16px;">',
          '  <h2 style="color:#fff;margin-bottom:16px;">验证你的邮箱</h2>',
          '  <p style="color:#8B90B8;line-height:1.6;">你正在注册 QBTI 量子人格测评账户，验证码如下：</p>',
          '  <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#FF8A48;margin:24px 0;text-align:center;">' + code + '</div>',
          '  <p style="color:#8B90B8;font-size:13px;">5 分钟内有效，请勿泄露给他人。</p>',
          '</div>'
        ].join('\n'),
      });
      console.log('[Mailer] 邮件已发送到 ' + email);
    } catch (err) {
      console.error('[Mailer] 发送失败:', err.message);
      return res.status(500).json({ error: '邮件发送失败：' + err.message });
    }
  }

  const isDev = !mailer;
  res.json({
    success: true,
    message: isDev ? '验证码已生成，请查看服务端控制台' : '验证码已发送到你的邮箱',
    devCode: isDev ? code : undefined,
  });
});

/* ---------- 校验验证码 ---------- */
app.post('/api/verify-code', (req, res) => {
  const { email, phone, code } = req.body || {};
  const target = email ? 'email:' + email.toLowerCase().trim() :
                 phone ? 'phone:' + phone.trim() : null;

  if (!target || !code) return res.status(400).json({ error: '参数不完整' });

  const entry = codeStore.get(target);
  if (!entry) return res.status(400).json({ error: '请先发送验证码' });
  if (Date.now() > entry.expiresAt) {
    codeStore.delete(target);
    return res.status(400).json({ error: '验证码已过期，请重新发送' });
  }
  if (entry.attempts >= 5) {
    codeStore.delete(target);
    return res.status(400).json({ error: '错误次数过多，请重新发送' });
  }
  if (entry.code !== String(code)) {
    entry.attempts++;
    return res.status(400).json({ error: '验证码不正确' });
  }

  codeStore.delete(target);
  res.json({ success: true });
});

/* ---------- 健康检查 ---------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mailer: !!mailer });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('  QBTI 本地服务器已启动');
  console.log('  访问：http://localhost:' + PORT);
  console.log('===========================================');
  console.log('');
});