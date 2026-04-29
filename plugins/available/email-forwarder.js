const nodemailer = require('nodemailer');

let transporter = null;

module.exports = {
  meta: {
    id: 'email-forwarder',
    name: 'Email Forwarder',
    version: '1.0.0',
    description: '将消息转发到邮箱，支持SMTP配置和邮件模板',
    author: 'Miotify',
    license: 'MIT',
    homepage: 'https://github.com/miotify',
  },

  defaultConfig: {
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@example.com',
        pass: 'your-password',
      },
    },
    from: '"Miotify" <noreply@example.com>',
    to: 'admin@example.com',
    subject: '[Miotify] {title}',
    minPriority: 0,
    enabledApps: [],
  },

  hooks: {
    'message:afterSend': async (ctx, message) => {
      const { config, log } = ctx;

      if (!transporter) {
        log('error', 'Email transporter not initialized');
        return;
      }

      if (message.priority < (config.minPriority || 0)) {
        log('info', `Skipping email for low priority message: ${message.id}`);
        return;
      }

      if (config.enabledApps && config.enabledApps.length > 0) {
        if (!config.enabledApps.includes(message.appid)) {
          log('info', `Skipping email for app ${message.appid} (not in enabledApps)`);
          return;
        }
      }

      const subject = (config.subject || '[Miotify] {title}')
        .replace('{title}', message.title || 'No Title')
        .replace('{priority}', String(message.priority));

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${escapeHtml(message.title || 'New Message')}</h2>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Priority: ${getPriorityLabel(message.priority)}</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 16px 0; white-space: pre-wrap; word-break: break-word;">${escapeHtml(message.message)}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              Message ID: ${message.id}<br>
              App ID: ${message.appid}<br>
              Time: ${message.created_at}
            </p>
          </div>
          <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
            Sent by Miotify
          </p>
        </div>
      `;

      const text = `[${message.title || 'New Message'}]\nPriority: ${getPriorityLabel(message.priority)}\n\n${message.message}\n\n---\nMessage ID: ${message.id}\nApp ID: ${message.appid}\nTime: ${message.created_at}`;

      try {
        const info = await transporter.sendMail({
          from: config.from || '"Miotify" <noreply@example.com>',
          to: config.to || 'admin@example.com',
          subject,
          text,
          html,
        });

        log('info', `Email sent: ${info.messageId}`);

        const count = ctx.db.get('sentCount') || 0;
        ctx.db.set('sentCount', count + 1);
      } catch (err) {
        log('error', `Failed to send email: ${err.message}`);
      }
    },
  },

  init: (ctx) => {
    const { config, log } = ctx;

    if (!config.smtp || !config.smtp.host) {
      log('warn', 'SMTP configuration missing, email forwarding disabled');
      return;
    }

    if (config.smtp.host === 'smtp.example.com') {
      log('warn', 'Please configure SMTP settings before using email forwarding');
      return;
    }

    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port || 587,
      secure: config.smtp.secure || false,
      auth: config.smtp.auth,
    });

    transporter.verify((err) => {
      if (err) {
        log('error', `SMTP connection failed: ${err.message}`);
        transporter = null;
      } else {
        log('info', 'SMTP connection established');
      }
    });

    log('info', `Email Forwarder initialized (to: ${config.to})`);
  },

  destroy: () => {
    if (transporter) {
      transporter.close();
      transporter = null;
    }
    console.log('[Plugin:email-forwarder] Plugin destroyed');
  },
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPriorityLabel(priority) {
  if (priority >= 5) return `High (${priority})`;
  if (priority >= 2) return `Medium (${priority})`;
  return `Low (${priority})`;
}
