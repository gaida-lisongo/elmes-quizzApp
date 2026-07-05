import nodemailer from "nodemailer";

type MailAttachment = {
  name: string;
  contentBytes: string;
  contentType: string;
};

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type MailSendInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
};

const readEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const parsePort = (value: string | null) => {
  if (!value) {
    return 587;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error("mail_port_invalid");
  }

  return parsedValue;
};

const parseSecure = (value: string | null) => {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  if (
    normalizedValue === "true" ||
    normalizedValue === "1" ||
    normalizedValue === "yes"
  ) {
    return true;
  }

  if (
    normalizedValue === "false" ||
    normalizedValue === "0" ||
    normalizedValue === "no"
  ) {
    return false;
  }

  throw new Error("mail_secure_invalid");
};

export class Mail {
  private static instance: Mail | null = null;

  static getInstance() {
    if (!Mail.instance) {
      Mail.instance = new Mail();
    }

    return Mail.instance;
  }

  getConfig(): MailConfig {
    const host = readEnv("MAIL_HOST");
    const port = parsePort(readEnv("MAIL_PORT", "MAIL-PORT"));
    const secure = parseSecure(readEnv("MAIL_SECURE"));
    const user = readEnv("MAIL_USER");
    const pass = readEnv("MAIL_PASS");
    const from = readEnv("MAIL_FROM", "MAIL_USER");

    if (!host) {
      throw new Error("mail_host_missing");
    }

    if (!user) {
      throw new Error("mail_user_missing");
    }

    if (!pass) {
      throw new Error("mail_pass_missing");
    }

    const sender = from ?? user;

    return {
      host,
      port,
      secure,
      user,
      pass,
      from: sender,
    };
  }

  createTransporter() {
    const config = this.getConfig();

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        servername: config.host,
      },
    });
  }

  async send({ to, subject, html, from, replyTo, attachments }: MailSendInput) {
    const recipients = Array.isArray(to) ? to : [to];

    if (recipients.length === 0) {
      throw new Error("mail_recipient_missing");
    }

    const config = this.getConfig();
    const transporter = this.createTransporter();

    return transporter.sendMail({
      from: from ?? config.from ?? config.user,
      to: recipients.join(", "),
      subject,
      html,
      replyTo: replyTo,
      attachments:
        attachments?.map((attachment) => ({
          filename: attachment.name,
          content: Buffer.from(attachment.contentBytes, "base64"),
          contentType: attachment.contentType,
        })) ?? [],
    });
  }

  async test() {
    const config = this.getConfig();
    const transporter = this.createTransporter();
    await transporter.verify();

    return {
      ok: true,
      host: config.host,
      port: config.port,
      secure: config.secure,
      from: config.from,
    };
  }

  async sendTestMail(to?: string) {
    const config = this.getConfig();
    const recipient = to?.trim() || config.user;
    const sentAt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "Africa/Kinshasa",
    }).format(new Date());

    const info = await this.send({
      to: recipient,
      subject: "Test SMTP INBTP",
      html: `
        <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#1f2937;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:28px;">
            <h1 style="margin:0 0 16px;font-size:22px;">Test du serveur mail</h1>
            <p style="margin:0 0 12px;">Cet email confirme que le transport SMTP configure dans l'application fonctionne.</p>
            <p style="margin:0 0 12px;"><strong>Serveur:</strong> ${config.host}:${config.port}</p>
            <p style="margin:0;"><strong>Date:</strong> ${sentAt}</p>
          </div>
        </div>
      `,
    });

    return {
      ok: true,
      to: recipient,
      from: config.from,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      envelope: info.envelope,
      response: info.response,
    };
  }
}

export const mailService = Mail.getInstance();
export const sendMail = (input: MailSendInput) => mailService.send(input);