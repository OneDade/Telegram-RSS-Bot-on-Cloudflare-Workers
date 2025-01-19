export interface RSSSubscription {
  id?: number;
  user_id: number;
  feed_url: string;
  last_fetch_time?: number;
  last_item_guid?: string;
  created_at: number;
}

export class Database {
  constructor(private db: D1Database) {}

  async createUserConfig(userId: number): Promise<void> {
    const now = Date.now();
    await this.db.prepare("INSERT INTO user_configs (user_id, fetch_interval, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(userId, 10, now, now).run();
  }

  async updateFetchInterval(userId: number, interval: number): Promise<void> {
    await this.db.prepare("UPDATE user_configs SET fetch_interval = ?, updated_at = ? WHERE user_id = ?").bind(interval, Date.now(), userId).run();
  }

  // RSS订阅相关操作
  async addSubscription(userId: number, feedUrl: string): Promise<void> {
    const now = Date.now();
    await this.db.prepare("INSERT INTO rss_subscriptions (user_id, feed_url, created_at) VALUES (?, ?, ?)").bind(userId, feedUrl, now).run();
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
