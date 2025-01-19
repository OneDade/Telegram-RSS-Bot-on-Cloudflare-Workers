# Telegram RSS Bot on Cloudflare Workers

English | [简体中文](docs/README-zh_CN.md)

A Telegram RSS subscription bot built with Cloudflare Workers and D1 database. Free and stable.

demo: <https://t.me/atri_rss_bot>

## Command List

- `/sub <rss_url>` - Subscribe to RSS feed
- `/unsub <rss_url>` - Unsubscribe from RSS feed
- `/list` - List all subscribed RSS feeds
- `/start` - View help information

## Deployment Guide

1. Prerequisites: Register a Cloudflare account, create a bot on [Telegram](https://t.me/botfather) and get the bot token
2. Clone the repository
   ```sh
   git clone https://github.com/lxl66566/Telegram-RSS-Bot-on-Cloudflare-Workers.git
   cd Telegram-RSS-Bot-on-Cloudflare-Workers
   ```
3. Install dependencies
   ```sh
   pnpm i
   pnpm i wrangler -g
   ```
4. Deploy the project (worker name is set to `telegram_rss_bot`, you can modify it)
   ```sh
   wrangler d1 create telegram_rss_bot                                  # Create d1 database
   # Then fill the returned d1 database information into `[[d1_databases]]` in wrangler.toml
   wrangler d1 execute telegram_rss_bot --file=./schema.sql --remote    # Create database tables
   wrangler deploy                                                      # Deploy the project
   wrangler secret put TELEGRAM_BOT_TOKEN                               # Set bot token
   ```
5. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>` to set up the webhook. You can find `YOUR_WORKER_URL` in the Workers page of Cloudflare Dashboard.
6. If you encounter any issues after deployment, you can check the logs using `wrangler tail telegram_rss_bot`.
