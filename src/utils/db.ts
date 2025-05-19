import { Language } from "./i18n";

export interface RSSSubscription {
  id?: number;
  user_id: number;
  feed_url: string;
  feed_title: string;
  last_fetch_time?: number;
  last_item_guid?: string;
  created_at: number;
}

export class Database {
  private cache: Cache;
  private cacheUrl: string;

  constructor(private db: D1Database) {
    this.cache = caches.default;
    this.cacheUrl = "https://telegram-rss-bot.workers.dev"; // 使用你的 worker URL 作为 base url
  }

  // 用户语言设置相关操作
  async getUserLanguage(userId: number): Promise<Language> {
    const cacheKey = new URL(`/cache/user_lang_${userId}`, this.cacheUrl).toString();

    try {
      // 尝试从缓存获取
      const cachedResponse = await this.cache.match(cacheKey);
      if (cachedResponse) {
        const cachedLang = await cachedResponse.text();
        return cachedLang as Language;
      }

      // 如果缓存中没有，从数据库获取
      const result = await this.db.prepare("SELECT language FROM user_settings WHERE user_id = ?").bind(userId).first<{ language: Language }>();

      const lang = result?.language || "zh";

      // 将结果存入缓存，设置 1 小时过期时间
      await this.cache.put(
        cacheKey,
        new Response(lang, {
          headers: {
            "Cache-Control": "max-age=3600",
          },
        }),
      );

      return lang;
    } catch (error) {
      console.error("Error getting user language:", error);
      return "zh"; // 发生错误时返回默认语言
    }
  }

  async setUserLanguage(userId: number, language: Language): Promise<void> {
    const cacheKey = new URL(`/cache/user_lang_${userId}`, this.cacheUrl).toString();

    try {
      // 更新数据库
      await this.db.prepare("INSERT OR REPLACE INTO user_settings (user_id, language) VALUES (?, ?)").bind(userId, language).run();

      // 删除旧的缓存
      await this.cache.delete(cacheKey);

      // 设置新的缓存，但强制立即过期以确保下次获取时会重新从数据库读取
      await this.cache.put(
        cacheKey,
        new Response(language, {
          headers: {
            "Cache-Control": "max-age=0, must-revalidate",
          },
        }),
      );
    } catch (error) {
      console.error("Error setting user language:", error);
      throw error;
    }
  }

  // RSS订阅相关操作
  async addSubscription(userId: number, feedUrl: string, feedTitle: string): Promise<void> {
    const now = Date.now();
    await this.db
      .prepare("INSERT INTO rss_subscriptions (user_id, feed_url, feed_title, created_at) VALUES (?, ?, ?, ?)")
      .bind(userId, feedUrl, feedTitle, now)
      .run();
  }

  async removeSubscription(userId: number, feedUrl: string): Promise<void> {
    await this.db.prepare("DELETE FROM rss_subscriptions WHERE user_id = ? AND feed_url = ?").bind(userId, feedUrl).run();
  }

  async listSubscriptions(userId: number): Promise<RSSSubscription[]> {
    return await this.db
      .prepare("SELECT * FROM rss_subscriptions WHERE user_id = ?")
      .bind(userId)
      .all<RSSSubscription>()
      .then((result) => result.results);
  }

  async updateLastFetch(userId: number, feedUrl: string, lastFetchTime: number, lastItemGuid: string): Promise<void> {
    await this.db
      .prepare("UPDATE rss_subscriptions SET last_fetch_time = ?, last_item_guid = ? WHERE user_id = ? AND feed_url = ?")
      .bind(lastFetchTime, lastItemGuid, userId, feedUrl)
      .run();
  }

  async getSubscriptionsToUpdate(interval: number): Promise<RSSSubscription[]> {
    const cutoffTime = Date.now() - interval * 60 * 1000;
    return await this.db
      .prepare("SELECT * FROM rss_subscriptions WHERE last_fetch_time IS NULL OR last_fetch_time < ?")
      .bind(cutoffTime)
      .all<RSSSubscription>()
      .then((result) => result.results);
  }
}
