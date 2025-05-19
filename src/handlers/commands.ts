import { TelegramMessage as Message } from "@codebam/cf-workers-telegram-bot";
import { Database } from "../utils/db";
import { RSSUtil } from "../utils/rss";
import { sendMessage } from "../utils/tgapi";
import { Language, getMessage } from "../utils/i18n";

export class CommandHandler {
  constructor(private db: Database, private rssUtil: RSSUtil, private token: string) {}

  async sendMessage(chatId: number, text: string, options?: Record<string, any>) {
    return await sendMessage(this.token, chatId, text, options);
  }

  async handleStart(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const helpText = getMessage(lang, "help");
    await this.sendMessage(message.chat.id, helpText, { disable_web_page_preview: true });
  }

  async handleLanguage(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const currentLang = await this.db.getUserLanguage(userId);
    const newLang: Language = currentLang === "zh" ? "en" : "zh";
    await this.db.setUserLanguage(userId, newLang);

    // 显示新语言的帮助信息
    const helpText = getMessage(newLang, "help");
    await this.sendMessage(message.chat.id, helpText, { disable_web_page_preview: true });
  }

  async handleSubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const feedUrl = message.text?.split(" ")[1];
    if (!feedUrl) {
      await this.sendMessage(message.chat.id, getMessage(lang, "url_required"));
      return;
    }

    try {
      // 先尝试获取 feed，确保 URL 有效
      const { items, feedTitle } = await this.rssUtil.fetchFeed(feedUrl);

      // 添加订阅
      await this.db.addSubscription(userId, feedUrl, feedTitle);

      // 更新最后获取时间和 GUID
      if (items.length > 0) {
        await this.db.updateLastFetch(userId, feedUrl, Date.now(), items[0].guid);

        // 发送成功订阅消息和最新文章
        const latestArticle = this.rssUtil.formatMessage(items[0], undefined, lang);
        await this.sendMessage(message.chat.id, getMessage(lang, "subscribe_success", { title: feedTitle, url: feedUrl, article: latestArticle }));
      } else {
        await this.sendMessage(message.chat.id, getMessage(lang, "subscribe_success_no_articles", { title: feedTitle, url: feedUrl }));
      }
    } catch (error) {
      await this.sendMessage(message.chat.id, getMessage(lang, "subscribe_failed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  }

  async handleUnsubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const feedUrl = message.text?.split(" ")[1];
    if (!feedUrl) {
      await this.sendMessage(message.chat.id, getMessage(lang, "url_required"));
      return;
    }

    try {
      await this.db.removeSubscription(userId, feedUrl);
      await this.sendMessage(message.chat.id, getMessage(lang, "unsubscribe_success", { url: feedUrl }));
    } catch (error) {
      await this.sendMessage(message.chat.id, getMessage(lang, "unsubscribe_failed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  }

  async handleList(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const lang = await this.db.getUserLanguage(userId);
    const subscriptions = await this.db.listSubscriptions(userId);
    if (subscriptions.length === 0) {
      await this.sendMessage(message.chat.id, getMessage(lang, "list_empty"));
      return;
    }

    const subscriptionList = subscriptions.map((sub, index) => `${index + 1}. [${sub.feed_title}](${sub.feed_url})`).join("\n");
    await this.sendMessage(message.chat.id, `${getMessage(lang, "list_header")}\n${subscriptionList}`);
  }
}
