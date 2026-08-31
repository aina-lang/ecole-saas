import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Envoi d'e-mails transactionnels (réinitialisation de mot de passe).
// Configuration par variables d'environnement :
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (false), SMTP_USER, SMTP_PASS, MAIL_FROM
// Exemple Gmail : SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=xxx@gmail.com
// SMTP_PASS=<mot de passe d'application> MAIL_FROM="Sekoliko <xxx@gmail.com>"
// Sans configuration, l'envoi est journalisé au lieu d'être expédié (dev).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      this.logger.log(`SMTP configuré (${host})`);
    } else {
      this.logger.warn('SMTP non configuré : les e-mails seront seulement journalisés');
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[mail non envoyé] à ${to} — ${subject}\n${text}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Envoi e-mail à ${to} échoué : ${(err as Error).message}`);
      return false;
    }
  }
}
