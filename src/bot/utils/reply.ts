// bot/utils/reply.ts - Telegram message splitting utility
// Telegram limits messages to 4096 characters. Split long texts at newlines.
import { Context } from 'grammy';

const LIMIT = 4000;

function splitText(text: string): string[] {
  if (text.length <= LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > LIMIT) {
    let pos = remaining.lastIndexOf('\n', LIMIT);
    if (pos <= 0) pos = LIMIT; // no newline found — hard cut
    chunks.push(remaining.slice(0, pos));
    remaining = remaining.slice(pos + 1); // skip the newline
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function sendLongReply(
  ctx: Context,
  text: string,
  options?: Parameters<Context['reply']>[1]
): Promise<void> {
  const chunks = splitText(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk, options);
  }
}
