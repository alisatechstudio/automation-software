import fs from 'node:fs';
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import type { ApprovalManager } from './manager.js';
import { logger } from '../logger.js';

export interface TelegramBotOptions {
  botToken?: string;
  chatId?: string;
  adminUserId?: string;
  approvalManager: ApprovalManager;
}

export class TelegramApprovalBot {
  private bot: Bot | null = null;
  private chatId?: string;
  private adminUserId?: string;
  private approvalManager: ApprovalManager;

  constructor(options: TelegramBotOptions) {
    this.approvalManager = options.approvalManager;
    this.chatId = options.chatId;
    this.adminUserId = options.adminUserId;

    if (options.botToken) {
      this.bot = new Bot(options.botToken);
      this.setupHandlers();
    }
  }

  public async start(): Promise<void> {
    if (!this.bot) {
      logger.info('Telegram bot token not provided; bot polling disabled.');
      return;
    }

    try {
      this.bot.start({
        onStart: (botInfo) => {
          logger.info({ username: botInfo.username }, 'Telegram approval bot started polling successfully.');
        },
      });
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed starting Telegram bot polling');
    }
  }

  public async sendApprovalRequest(item: {
    videoId: string;
    title: string;
    duration: number;
    originalityRatio: number;
    licenseType: string;
    licenseProofUrl: string;
    credit: string;
    complianceSummary: string;
    script: string;
    thumbnailPath?: string;
  }): Promise<void> {
    if (!this.bot || !this.chatId) {
      logger.debug({ videoId: item.videoId }, 'Telegram bot or chatId not configured. Skipping push message.');
      return;
    }

    const caption = [
      `🚨 *ACTION REQUIRED: Video Human Approval*`,
      ``,
      `🎬 *Title:* ${this.escapeMarkdown(item.title)}`,
      `⏱ *Duration:* ${Math.round(item.duration)}s | *Original Content:* ${Math.round(item.originalityRatio * 100)}%`,
      `⚖️ *License:* \`${item.licenseType}\``,
      `🔗 *Proof:* [Verification Link](${item.licenseProofUrl})`,
      `🏷 *Attribution:* ${this.escapeMarkdown(item.credit)}`,
      ``,
      `🛡 *Compliance Gate Status:*`,
      `_${this.escapeMarkdown(item.complianceSummary)}_`,
      ``,
      `📝 *Script Preview:*`,
      `"${this.escapeMarkdown(item.script.slice(0, 180))}..."`,
      ``,
      `_Only explicitly approved videos will be published._`,
    ].join('\n');

    const keyboard = new InlineKeyboard()
      .text('✅ Approve & Publish', `approve:${item.videoId}`)
      .text('❌ Reject', `reject:${item.videoId}`);

    try {
      if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
        await this.bot.api.sendPhoto(this.chatId, new InputFile(item.thumbnailPath), {
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } else {
        await this.bot.api.sendMessage(this.chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        });
      }
      logger.info({ videoId: item.videoId }, 'Approval request sent to Telegram.');
    } catch (err: any) {
      logger.error({ videoId: item.videoId, err: err.message }, 'Failed sending approval request to Telegram');
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.callbackQuery(/^(approve|reject):(.+)$/, async (ctx) => {
      const match = ctx.match;
      const action = match[1];
      const videoId = match[2];
      const reviewer = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.first_name} (ID: ${ctx.from.id})`;

      logger.info({ action, videoId, reviewer }, 'Received Telegram approval decision');

      if (action === 'approve') {
        const res = await this.approvalManager.approve(videoId, reviewer);
        await ctx.answerCallbackQuery({ text: res.message });
        await ctx.editMessageCaption({
          caption: `${ctx.callbackQuery.message?.caption || ''}\n\n✅ *APPROVED* by ${reviewer} at ${new Date().toLocaleTimeString()}`,
          parse_mode: 'Markdown',
        });
      } else {
        const res = await this.approvalManager.reject(videoId, reviewer, 'Rejected via Telegram inline button');
        await ctx.answerCallbackQuery({ text: res.message });
        await ctx.editMessageCaption({
          caption: `${ctx.callbackQuery.message?.caption || ''}\n\n❌ *REJECTED* by ${reviewer} at ${new Date().toLocaleTimeString()}`,
          parse_mode: 'Markdown',
        });
      }
    });

    this.bot.command('status', async (ctx) => {
      const pending = await this.approvalManager.getPendingReviewList();
      await ctx.reply(`📊 SportsClipBot Status:\n- Pending Approvals: ${pending.length}\n- System Status: Active`);
    });
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }
}
