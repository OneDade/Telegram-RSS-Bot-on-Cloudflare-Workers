import telegramifyMarkdown from "telegramify-markdown";

async function sendMessage(bot_token: string, chatId: number, text: string, options?: Record<string, any>) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramifyMarkdown(text, "escape"),
        parse_mode: options?.parse_mode || "MarkdownV2",
        ...options,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${response.status} - ${errorText}`);
    }

    return response;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

export { sendMessage };
