import type { Notifier } from "./notifier.port.ts"

export interface SentMessage {
  readonly chatId: number
  readonly html: string
}

/**
 * Records what would have been sent. Service tests use this so the whole
 * reminder path can run without a network.
 */
export class FakeNotifier implements Notifier {
  readonly sent: SentMessage[] = []
  /** Set to make the next sends fail, e.g. with a ChatGoneError. */
  failWith: Error | null = null

  async sendHtml(chatId: number, html: string): Promise<void> {
    if (this.failWith) throw this.failWith
    this.sent.push({ chatId, html })
  }
}
