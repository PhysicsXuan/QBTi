/* ============================================================
   QBTI 后端服务器（AgentMail API 版本）
   - 使用 AgentMail 免费 API 发送验证码
   - 无需域名、无需手机号
   ============================================================ */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* ---------- 配置 ---------- */
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

if (!AGENTMAIL_API_KEY) {
  console.log('⚠️  未配置 AGENTMAIL_API_KEY，验证码将打印在控制台');
} else {
  console.log('✅ AgentMail 已配置');
}

/* ---------- 自动准备一个收件箱 ---------- */
let inboxId = null;
let inboxAddress = null;

async function ensureInbox() {
  if (!AGENTMAIL_API_KEY) return null;
  if (inboxId) return inboxId;

  try {
    // 先查询已有 inbox
    const listRes = await fetch(AGENTMAIL_BASE + '/inboxes', {
      headers: { 'Authorization': 'Bearer ' + AGENTMAIL_API_KEY }
    });
    const listText = await listRes.text();
    console.log('[AgentMail] 查询 inbox 状态码:', listRes.status);
    console.log('[AgentMail] 查询 inbox 返回:', listText.slice(0, 300));

    let inboxes = [];
    try {
      const listData = JSON.parse(listText);
      inboxes = listData.inboxes || listData.data || (Array.isArray(listData) ? listData : []);
    } catch(e){}

    if (inboxes.length > 0) {
      inboxId = inboxes[0].inboxId || inboxes[0].id || inboxes[0].inbox_id;
      inboxAddress = inboxes[0].address || inboxes[0].email || inboxes[0].inboxId;
      console.log('[AgentMail] 使用已有 inbox:', inboxId, '(', inboxAddress, ')');
      return inboxId;
    }

    // 没有则创建一个
    const createRes = await fetch(AGENTMAIL_BASE + '/inboxes', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + AGENTMAIL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const createText = await createRes.text();
    console.log('[AgentMail] 创建 inbox 状态码:', createRes.status);
    console.log('[AgentMail] 创建 inbox 返回:', createText.slice(0, 300));

    if (!createRes.ok) {
      console.error('[AgentMail] 创建 inbox 失败');
      return null;
    }

    const created = JSON.parse(createText);
    inboxId = created.inboxId || created.id || created.inbox_id;
    inboxAddress = created.address || created.email || inboxId;
    console.log('[AgentMail] 新建 inbox:', inboxId, '(', inboxAddress, ')');
    return inboxId;
  } catch(err) {
    console.error('[AgentMail] ensureInbox 异常:', err.message);
    return null;
  }
}

// 启动时预热
setTimeout(() => { ensureInbox(); }, 1000);

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

/* ---------- 发送验证码 ---------- */
app.post('/api/send-code', async (req, res) => {
  const { email, phone } = req.body || {};
  const target = email ? 'email:' + email.toLowerCase().trim() :
                 phone ? 'phone:' + phone.trim() : null;

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

  if (email && AGENTMAIL_API_KEY) {
    const inbox = await ensureInbox();
    if (!inbox) {
      return res.status(500).json({ error: '邮件服务未就绪，请稍后重试' });
    }

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
          })
        }
      );

      const sendText = await sendRes.text();
      console.log('[AgentMail] 发送状态码:', sendRes.status);
      console.log('[AgentMail] 发送返回:', sendText.slice(0, 400));

      if (!sendRes.ok) {
        let errMsg = '发送失败';
        try {
          const errJson = JSON.parse(sendText);
          errMsg = errJson.message || errJson.error || errMsg;
        } catch(e){}
        return res.status(500).json({ error: '邮件发送失败：' + errMsg });
      }

      console.log('[AgentMail] 邮件已发送到 ' + email);
    } catch (err) {
      console.error('[AgentMail] 发送异常:', err.message);
      return res.status(500).json({ error: '邮件发送失败：' + err.message });
    }
  }

  const isDev = !AGENTMAIL_API_KEY;
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
  res.json({ ok: true, mailer: !!AGENTMAIL_API_KEY, inbox: inboxId });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('  QBTI 本地服务器已启动');
  console.log('  访问：http://localhost:' + PORT);
  console.log('  邮件：' + (AGENTMAIL_API_KEY ? '✅ AgentMail 已启用' : '⚠️  未配置 AgentMail'));
  console.log('===========================================');
  console.log('');
});