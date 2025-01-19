import { TelegramMessage as Message } from "@codebam/cf-workers-telegram-bot";
import { Database } from "../utils/db";
import { RSSUtil } from "../utils/rss";
import telegramifyMarkdown from "telegramify-markdown";

export class CommandHandler {
  constructor(private db: Database, private rssUtil: RSSUtil, private token: string) {}

  async sendMessage(chatId: number, text: string, parseMode?: string, options?: Record<string, any>) {
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramifyMarkdown(text, "keep"),
        parse_mode: parseMode || "MarkdownV2",
        ...options,
      }),
    });
  }

  async handleStart(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;
    const helpText = `RSS Bot [仓库地址与部署说明](https://github.com/lxl66566/Telegram-RSS-Bot-on-Cloudflare-Workers)

/sub <rss_url> - 订阅一个 RSS 源
/unsub <rss_url> - 取消订阅 RSS 源
/list - 列出所有订阅的 RSS 源
/start - 显示此帮助信息`;

    await this.sendMessage(message.chat.id, helpText, undefined, { disable_web_page_preview: true });
  }

  async handleSubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const feedUrl = message.text?.split(" ")[1];
    if (!feedUrl) {
      await this.sendMessage(message.chat.id, "请提供 RSS 源的 URL");
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
        const latestArticle = this.rssUtil.formatMessage(items[0]);
        await this.sendMessage(message.chat.id, `成功订阅 RSS 源：[${feedTitle}](${feedUrl})\n\n最新文章：\n${latestArticle}`);
      } else {
        await this.sendMessage(message.chat.id, `成功订阅 RSS 源：[${feedTitle}](${feedUrl})\n\n当前没有任何文章`);
      }
    } catch (error) {
      await this.sendMessage(message.chat.id, `订阅失败：${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async handleUnsubscribe(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const feedUrl = message.text?.split(" ")[1];
    if (!feedUrl) {
      await this.sendMessage(message.chat.id, "请提供要取消订阅的 RSS 源 URL");
      return;
    }

    try {
      await this.db.removeSubscription(userId, feedUrl);
      await this.sendMessage(message.chat.id, `已取消订阅 RSS 源：${feedUrl}`);
    } catch (error) {
      await this.sendMessage(message.chat.id, `取消订阅失败：${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async handleList(message: Message): Promise<void> {
    const userId = message.from?.id;
    if (!userId) return;

    const subscriptions = await this.db.listSubscriptions(userId);
    if (subscriptions.length === 0) {
      await this.sendMessage(message.chat.id, "还没有订阅任何 RSS 源");
      return;
    }

    const subscriptionList = subscriptions.map((sub, index) => `${index + 1}. [${sub.feed_title}](${sub.feed_url})`).join("\n");
    await this.sendMessage(message.chat.id, `订阅列表：\n${subscriptionList}`);
  }
}
