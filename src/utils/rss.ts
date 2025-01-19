import Parser from "rss-parser";

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate?: string;
  // 不需要 content
  // content?: string
}

interface CacheEntry {
  items: FeedItem[];
  timestamp: number;
}

export class RSSUtil {
  private parser: Parser;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL: number;

  constructor(private readonly updateInterval: number) {
    this.CACHE_TTL = updateInterval * 60 * 1000;
    this.parser = new Parser({
      timeout: 5000,
      headers: {
        "User-Agent": "Telegram RSS Bot/1.0",
      },
    });
    this.cache = new Map();
  }

  async fetchFeed(url: string): Promise<FeedItem[]> {
    // 检查缓存
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.items;
    }

    try {
      const response = await fetch(url);
      const xml = await response.text();
      // Do not use `parseURL`: cloudflare worker does not support https.get
      // Failed to fetch RSS feed: [unenv] https.get is not implemented yet!
      const feed = await this.parser.parseString(xml);
      const items = feed.items.map((item) => ({
        title: item.title || "Untitled",
        link: item.link || "",
        guid: item.guid || item.link || "",
        pubDate: item.pubDate,
      }));

      // 更新缓存
      this.cache.set(url, {
        items,
        timestamp: now,
      });

      return items;
    } catch (error: unknown) {
      console.error(`Error fetching RSS feed from ${url}:`, error);
      throw error;
    }
  }

  formatMessage(item: FeedItem): string {
    return `📰 [${item.title}](${item.link})`;
  }
}
