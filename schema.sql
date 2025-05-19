-- RSS订阅表
CREATE TABLE
  IF NOT EXISTS rss_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, -- 订阅用户的 Telegram ID
    feed_title TEXT NOT NULL, -- 订阅源名称
    feed_url TEXT NOT NULL, -- RSS feed URL
    last_fetch_time INTEGER, -- 最后一次获取更新的时间
    last_item_guid TEXT, -- 最后一篇文章的唯一标识
    created_at INTEGER NOT NULL, -- 订阅创建时间
    UNIQUE (user_id, feed_url) -- 确保用户不会重复订阅同一个源
  );

-- 用户语言设置表
CREATE TABLE
  IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    language TEXT NOT NULL DEFAULT 'zh' -- 用户语言设置，默认中文
  );

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON rss_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_last_fetch ON rss_subscriptions (last_fetch_time);

CREATE INDEX IF NOT EXISTS user_settings_language ON user_settings (language);