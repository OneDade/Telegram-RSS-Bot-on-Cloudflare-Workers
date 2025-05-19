import { Database } from "./utils/db";
import { RSSUtil } from "./utils/rss";
import { CommandHandler } from "./handlers/commands";
import { TelegramMessage } from "@codebam/cf-workers-telegram-bot";
import { sendMessage } from "./utils/tgapi";
import { getMessage } from "./utils/i18n";

interface TelegramUpdate {
  message?: TelegramMessage;
}

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  UPDATE_INTERVAL: number;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const db = new Database(env.DB);
    const rssUtil = new RSSUtil(env.UPDATE_INTERVAL);
    const commandHandler = new CommandHandler(db, rssUtil, env.TELEGRAM_BOT_TOKEN);

    if (request.method === "POST") {
      const update = (await request.json()) as TelegramUpdate;
      const message = update.message;

      if (!message?.text) {
        return new Response("OK");
      }

      const command = message.text.split(" ")[0];
      try {
        switch (command) {
          case "/start":
            await commandHandler.handleStart(message);
            break;
          case "/sub":
            await commandHandler.handleSubscribe(message);
            break;
          case "/unsub":
            await commandHandler.handleUnsubscribe(message);
            break;
          case "/list":
            await commandHandler.handleList(message);
            break;
          case "/lang":
            await commandHandler.handleLanguage(message);
            break;
        }
      } catch (error) {
        console.error("Error handling command:", error);
        const lang = await db.getUserLanguage(message.from?.id || 0);
        await commandHandler.sendMessage(message.chat.id, getMessage(lang, "error_processing"));
      }
    }

    return new Response("OK");
  },

  async scheduled(event: ScheduledEvent | null, env: Env, _ctx: ExecutionContext) {
    console.log("scheduled event triggered at ", new Date().toISOString());
    const db = new Database(env.DB);
    const rssUtil = new RSSUtil(env.UPDATE_INTERVAL);

    try {
      // 获取所有需要更新的订阅
      const subscriptions = await db.getSubscriptionsToUpdate(env.UPDATE_INTERVAL);
      const fetchPromises = subscriptions.map(async (sub) => {
        try {
          const { items } = await rssUtil.fetchFeed(sub.feed_url);
          const lastItemGuid = sub.last_item_guid;

          // 找到上次发送的文章的索引
          const lastIndex = lastItemGuid ? items.findIndex((item) => item.guid === lastItemGuid) : -1;
          // 如果找到了上次的文章,则发送它之前的所有新文章;如果是首次订阅,只发送最新的一条
          const newItems = lastIndex >= 0 ? items.slice(0, lastIndex) : items.slice(0, 1);

          if (newItems.length > 0) {
            // 发送更新通知
            const messages = newItems.map((item) => rssUtil.formatMessage(item, sub.feed_title));
            for (const message of messages) {
              await sendMessage(env.TELEGRAM_BOT_TOKEN, sub.user_id, message);
            }

            // 更新最后获取时间和 GUID
            await db.updateLastFetch(sub.user_id, sub.feed_url, Date.now(), items[0].guid);
          }
        } catch (error) {
          console.error(`Error processing subscription ${sub.feed_url}:`, error);
        }
      });
      await Promise.all(fetchPromises);
    } catch (error) {
      console.error("Error in scheduled task:", error);
    }
  },
};
