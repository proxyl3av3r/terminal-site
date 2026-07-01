import nodemailer from "nodemailer";

// Универсальный SMTP-транспорт. Подходит для любого провайдера:
// Resend (smtp.resend.com), почта домена, Brevo, Mailgun и т.д.
// Создаётся лениво, чтобы отсутствие переменных не роняло сборку.
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST / SMTP_USER / SMTP_PASS не заданы в .env — почта не настроена",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user, pass },
    // Пул + keepAlive: переиспользуем тёплое соединение вместо нового TLS-хендшейка
    // на каждое письмо. На нагруженной VPS холодный коннект иногда тянулся так
    // долго, что nginx рвал ответ — и клиент видел «network», хотя письмо ушло.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Жёсткие таймауты: лучше быстро упасть с честной ошибкой, чем висеть.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

const SITE = () => process.env.SITE_NAME ?? "terminal-site";

// Адрес отправителя. Для Resend — verified-домен, напр. noreply@send.bash-app.com.
const FROM = () =>
  process.env.EMAIL_FROM ?? `${SITE()} <${process.env.SMTP_USER}>`;

/** Email with the registration confirmation link. */
export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  const site = SITE();
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: `[${site}] confirm your registration`,
    text: `Confirm your email by opening the link (valid for 24h):\n${verifyUrl}\n\nIf this wasn't you, just ignore this email.`,
    html: terminalEmail(site, verifyUrl),
  });
}

/** Email with the password reset link. */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const site = SITE();
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: `[${site}] password reset`,
    text: `Reset your password by opening the link (valid for 1h):\n${resetUrl}\n\nIf you didn't request this, ignore this email — your password stays unchanged.`,
    html: terminalEmail(site, resetUrl, {
      cmd: "passwd --reset",
      body: "A password reset was requested for your account.<br/>Set a new password — the link is valid for <b style=\"color:#ffb000\">1 hour</b>:",
      button: "&gt; reset_password",
      footer:
        "Didn't request this? Ignore this email — your password stays unchanged.",
    }),
  });
}

// Минималистичный «терминальный» шаблон. Inline-стили — почтовые клиенты
// не любят внешний/блочный CSS.
interface EmailCopy {
  cmd: string;
  body: string;
  button: string;
  footer: string;
}
function terminalEmail(site: string, url: string, copy?: EmailCopy): string {
  const c: EmailCopy = copy ?? {
    cmd: "register --confirm",
    body: "Someone (hopefully you) created an account.<br/>Confirm your email — the link is valid for <b style=\"color:#ffb000\">24 hours</b>:",
    button: "&gt; confirm_email",
    footer:
      "Wasn't you? Ignore this email — an unconfirmed account stays inactive.",
  };
  return tpl(site, url, c);
}

function tpl(site: string, url: string, c: EmailCopy): string {
  return `
  <div style="background:#0a0a0a;padding:32px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#c8c8c8">
    <div style="max-width:520px;margin:0 auto;border:1px solid #1e1e1e;border-radius:8px;padding:28px;background:#101010">
      <div style="color:#39ff14;font-size:13px;margin-bottom:18px">${site} :: auth</div>
      <div style="font-size:14px;line-height:1.6;color:#c8c8c8">
        <span style="color:#39ff14">$</span> ${c.cmd}<br/><br/>
        ${c.body}
      </div>
      <div style="margin:24px 0">
        <a href="${url}" style="display:inline-block;background:#39ff14;color:#0a0a0a;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;font-size:13px">
          ${c.button}
        </a>
      </div>
      <div style="font-size:12px;color:#6a6a6a;line-height:1.6">
        If the button doesn't work, open the link manually:<br/>
        <span style="color:#6a6a6a;word-break:break-all">${url}</span><br/><br/>
        ${c.footer}
      </div>
    </div>
  </div>`;
}
