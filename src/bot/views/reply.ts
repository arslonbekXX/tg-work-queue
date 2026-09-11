/**
 * What a handler wants sent back. Python passed `parse_mode` and
 * `disable_web_page_preview` per call and was not consistent about it — several
 * replies went out as plain text — so the choice travels with the message
 * instead of being applied by the transport.
 */
export interface Reply {
  readonly text: string
  readonly parseMode: "HTML" | null
  readonly disableLinkPreview: boolean
}

/** `parse_mode=ParseMode.HTML`, link previews left alone. */
export function html(text: string): Reply {
  return { text, parseMode: "HTML", disableLinkPreview: false }
}

/** `parse_mode=ParseMode.HTML, disable_web_page_preview=True` — anything showing a task link. */
export function htmlWithoutPreview(text: string): Reply {
  return { text, parseMode: "HTML", disableLinkPreview: true }
}

/** `reply_text(...)` with no parse mode at all. */
export function plain(text: string): Reply {
  return { text, parseMode: null, disableLinkPreview: false }
}
