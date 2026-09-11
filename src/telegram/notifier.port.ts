/**
 * The outbound edge of the bot. Services depend on this rather than on grammY
 * so they can be tested without a network — one of only two ports in the
 * codebase, the other being the scheduler.
 */
export interface Notifier {
  sendHtml(chatId: number, html: string): Promise<void>
}

/**
 * The chat is gone for good: the bot was kicked, blocked, or the chat was
 * deleted. Retrying will never help, so the reminder is switched off instead of
 * failing on every tick and filling the log, which is what Python did.
 */
export class ChatGoneError extends Error {
  readonly chatId: number
  readonly reason: string

  constructor(chatId: number, reason: string) {
    super(`Chat ${chatId} is unreachable: ${reason}`)
    this.name = "ChatGoneError"
    this.chatId = chatId
    this.reason = reason
  }
}
