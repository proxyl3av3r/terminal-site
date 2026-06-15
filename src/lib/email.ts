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
  });
  return transporter;
}

const SITE = () => process.env.SITE_NAME ?? "terminal-site";

// Адрес отправителя. Для Resend — verified-домен, напр. noreply@klebold.xyz.
const FROM = () =>
  process.env.EMAIL_FROM ?? `${SITE()} <${process.env.SMTP_USER}>`;

/** Письмо со ссылкой подтверждения регистрации. */
export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<void> {
  const site = SITE();
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: `[${site}] подтверждение регистрации`,
    text: `Подтвердите email, перейдя по ссылке (действует 24ч):\n${verifyUrl}\n\nЕсли это были не вы — просто игнорируйте письмо.`,
    html: terminalEmail(site, verifyUrl),
  });
}

// Минималистичный «терминальный» шаблон. Inline-стили — почтовые клиенты
// не любят внешний/блочный CSS.
function terminalEmail(site: string, url: string): string {
  return `
  <div style="background:#0a0a0a;padding:32px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#c8c8c8">
    <div style="max-width:520px;margin:0 auto;border:1px solid #1e1e1e;border-radius:8px;padding:28px;background:#101010">
      <div style="color:#39ff14;font-size:13px;margin-bottom:18px">${site} :: auth</div>
      <div style="font-size:14px;line-height:1.6;color:#c8c8c8">
        <span style="color:#39ff14">$</span> register --confirm<br/><br/>
        Кто-то (надеемся, ты) создал аккаунт.<br/>
        Подтверди email — ссылка действует <b style="color:#ffb000">24 часа</b>:
      </div>
      <div style="margin:24px 0">
        <a href="${url}" style="display:inline-block;background:#39ff14;color:#0a0a0a;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;font-size:13px">
          &gt; confirm_email
        </a>
      </div>
      <div style="font-size:12px;color:#6a6a6a;line-height:1.6">
        Если кнопка не работает, открой ссылку вручную:<br/>
        <span style="color:#6a6a6a;word-break:break-all">${url}</span><br/><br/>
        Это были не вы? Игнорируйте письмо — аккаунт без подтверждения неактивен.
      </div>
    </div>
  </div>`;
}
