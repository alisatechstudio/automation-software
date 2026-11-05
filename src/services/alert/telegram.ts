import { config } from '../../config/env.js';

export interface AlertPayload {
  articleTitle: string;
  sourceName?: string;
  pageId?: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string;
  articleUrl?: string;
}

export class TelegramAlertService {
  private botToken?: string;
  private chatId?: string;

  constructor() {
    this.botToken = config.TELEGRAM_BOT_TOKEN;
    this.chatId = config.TELEGRAM_CHAT_ID;
  }

  public async sendFailureAlert(alert: AlertPayload): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.log('[TelegramAlert] Bot token or chat ID not configured, skipping alert.');
      return false;
    }

    const message = [
      '🚨 *News-to-Facebook Automation Alert*',
      '',
      `📰 *Article:* ${this.escapeMarkdown(alert.articleTitle)}`,
      alert.sourceName ? `📡 *Source:* ${this.escapeMarkdown(alert.sourceName)}` : '',
      alert.pageId ? `📄 *Page ID:* \`${alert.pageId}\`` : '',
      `🔄 *Retries Exhausted:* ${alert.attempts}/${alert.maxAttempts}`,
      `❌ *Error:* \`${this.escapeMarkdown(alert.errorMessage.substring(0, 300))}\``,
      alert.articleUrl ? `🔗 [Open Article](${alert.articleUrl})` : '',
      `⏰ *Time:* ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[TelegramAlert] Failed to send Telegram alert:', errText);
        return false;
      }

      console.log('[TelegramAlert] Failure alert delivered to Telegram.');
      return true;
    } catch (err) {
      console.error('[TelegramAlert] Network error sending Telegram message:', err);
      return false;
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
  }
}

