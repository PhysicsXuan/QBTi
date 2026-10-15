/* ============================================================
   QBTI 后端服务器（Resend API 版本）
   - 提供静态文件服务
   - 提供 /api/send-code 和 /api/verify-code
   - 使用 Resend HTTP API 发送邮件（不依赖 SMTP，不卡顿）
   ============================================================ */

const express = require('express');
const path = require('path');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* ---------- Resend 客户端 ---------- */
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('✅ Resend 已配置，将真实发送邮件');
} else {
  console.log('⚠️  未配置 RESEND_API_KEY，验证码将打印在控制台');
}

/* ---------- 内存存储验证码 ---------- */
const codeStore = new Map();

// 每 60 秒清理一次过期超过 10 分钟的条目
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of codeStore) {
    if (val.expiresAt < now && (now - val.lastSentAt) > 10 * 60 * 1000) {
      codeStore.delete(key);
    }
  }
}, 60 * 1000);

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

  if (email && resend) {
    try {
      const result = await resend.emails.send({
        from: 'QBTI <onboarding@resend.dev>',
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
      if (result.error) {
        console.error('[Resend] 发送失败:', result.error);
        return res.status(500).json({ error: '邮件发送失败：' + result.error.message });
      }
      console.log('[Resend] 邮件已发送到 ' + email);
    } catch (err) {
      console.error('[Resend] 发送异常:', err.message);
      return res.status(500).json({ error: '邮件发送失败：' + err.message });
    }
  }

  const isDev = !resend;
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
  res.json({ ok: true, mailer: !!resend });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('  QBTI 本地服务器已启动');
  console.log('  访问：http://localhost:' + PORT);
  console.log('  邮件：' + (resend ? '✅ Resend 已启用' : '⚠️  未配置 Resend'));
  console.log('===========================================');
  console.log('');
});