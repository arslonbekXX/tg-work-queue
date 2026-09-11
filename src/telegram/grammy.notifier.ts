import type { Api } from "grammy"
import { GrammyError } from "grammy"
import { ChatGoneError, type Notifier } from "./notifier.port.ts"

/**
 * Reminders always went out as HTML with link previews suppressed, so those
 * options live here rather than at every call site.
 */
export class GrammyNotifier implements Notifier {
  readonly #api: Api

  constructor(api: Api) {
    this.#api = api
  }

  async sendHtml(chatId: number, html: string): Promise<void> {
    try {
      await this.#api.sendMessage(chatId, html, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      })
    } catch (error) {
      if (error instanceof GrammyError && describesGoneChat(error)) {
        throw new ChatGoneError(chatId, error.description)
      }
      throw error
    }
  }
}

/**
 * 403 covers being kicked, blocked or removed. Telegram reports a deleted chat
 * as a 400 with a specific description, which is the only 400 worth treating as
 * permanent — the rest are our own mistakes and should surface as errors.
 */
export function describesGoneChat(error: { error_code: number; description: string }): boolean {
  if (error.error_code === 403) return true
  return error.error_code === 400 && error.description.toLowerCase().includes("chat not found")
}
