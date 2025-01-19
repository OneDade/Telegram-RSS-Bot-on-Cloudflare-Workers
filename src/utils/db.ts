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
  constructor(private db: D1Database) {}

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
