import { describe, expect, test } from "bun:test"
import type { Reminder } from "@domain/reminder.ts"
import type { Task } from "@domain/task.ts"
import * as errors from "./errors.view.ts"
import { help } from "./help.view.ts"
import * as reminders from "./reminder.view.ts"
import * as tasks from "./task.view.ts"
import { emptyQueue, reminderList, taskList } from "./task-list.view.ts"

/**
 * The parity guard. Expected strings here were transcribed by reading bot.py
 * and scheduler.py, not produced by running this code — a snapshot would only
 * record whatever the new implementation happens to emit, including a bug
 * faithfully carried across.
 */

const MR_URL = "http://gitlab.example.com/group/monorepo/-/merge_requests/120"
const PR_URL = "https://github.com/owner/backend/pull/45"

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    chatId: -100,
    seqNum: 1,
    taskId: "monorepo/120",
    url: MR_URL,
    assignees: [],
    createdBy: "@dave",
    createdAt: "2026-01-01 09:00:00",
    ...overrides,
  }
}

describe("!w", () => {
  test("says so when the queue is empty, without a parse mode", () => {
    expect(emptyQueue()).toEqual({
      text: "No tasks in the queue.",
      parseMode: null,
      disableLinkPreview: false,
    })
  })

  test("prints one line per task, with no heading", () => {
    const reply = taskList([
      task({ seqNum: 1, assignees: ["@alice", "@bob"] }),
      task({ id: 2, seqNum: 2, taskId: "backend/45", url: PR_URL }),
    ])

    expect(reply.text).toBe(
      `[#1] <a href="${MR_URL}">monorepo/120</a> → @alice, @bob (by @dave)\n` +
        `[#2] <a href="${PR_URL}">backend/45</a> (by @dave)`,
    )
    expect(reply.parseMode).toBe("HTML")
    expect(reply.disableLinkPreview).toBe(true)
  })
})

describe("the scheduled reminder", () => {
  test("adds a heading and a blank line above the same lines", () => {
    const reply = reminderList([task({ assignees: ["@alice"] })])

    expect(reply.text).toBe(
      "<b>📋 Reminder: Pending Reviews</b>\n" +
        "\n" +
        `[#1] <a href="${MR_URL}">monorepo/120</a> → @alice (by @dave)`,
    )
    expect(reply.disableLinkPreview).toBe(true)
  })
})

describe("!wadd", () => {
  test("confirms an unassigned task", () => {
    expect(tasks.taskAdded(1, MR_URL, "monorepo/120", []).text).toBe(
      `[#1] <a href="${MR_URL}">monorepo/120</a>`,
    )
  })

  test("confirms assignees in the order they were typed", () => {
    expect(tasks.taskAdded(3, MR_URL, "monorepo/120", ["@zoe", "@adam"]).text).toBe(
      `[#3] <a href="${MR_URL}">monorepo/120</a> → @zoe, @adam`,
    )
  })

  test("reports a duplicate as plain text, leaving the id unescaped", () => {
    expect(tasks.taskAlreadyQueued("monorepo/120")).toEqual({
      text: "Task monorepo/120 already exists in the queue.",
      parseMode: null,
      disableLinkPreview: false,
    })
  })

  test("reports an unsupported link as plain text", () => {
    expect(errors.unsupportedLink()).toEqual({
      text:
        "Invalid URL. Please provide a GitLab merge request or GitHub pull request link.\n" +
        "Examples:\n" +
        "• http://gitlab.example.com/group/repo/-/merge_requests/123\n" +
        "• https://github.com/owner/repo/pull/123",
      parseMode: null,
      disableLinkPreview: false,
    })
  })
})

describe("!wadd argument errors", () => {
  test("missing URL", () => {
    expect(errors.waddFailure({ kind: "missing-url" }).text).toBe(
      "Missing URL.\n" +
        "Usage: <code>!wadd &lt;URL&gt; [@username ...]</code>\n" +
        "Examples:\n" +
        "• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123</code>\n" +
        "• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice</code>\n" +
        "• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice @bob</code>",
    )
  })

  test("username given before the URL", () => {
    expect(errors.waddFailure({ kind: "username-before-url" }).text).toBe(
      "Missing URL. Provide a GitLab MR or GitHub PR link before the username(s).",
    )
  })

  test("bad scheme, two-part form carries the example", () => {
    expect(errors.waddFailure({ kind: "url-scheme-with-example" }).text).toBe(
      "Invalid URL. Must start with http:// or https://\n" +
        "Example: <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123</code>",
    )
  })

  test("bad scheme, longer form is the bare sentence", () => {
    expect(errors.waddFailure({ kind: "url-scheme" }).text).toBe(
      "Invalid URL. Must start with http:// or https://",
    )
  })

  test("unsupported host", () => {
    expect(errors.waddFailure({ kind: "unsupported-url" }).text).toBe(
      "Unsupported URL format. Must be a GitLab merge request or GitHub pull request.\n" +
        "Supported formats:\n" +
        "• <code>http://host/group/project/-/merge_requests/N</code>\n" +
        "• <code>https://github.com/owner/repo/pull/N</code>",
    )
  })

  test("quotes back what was given instead of a username, escaped", () => {
    expect(errors.waddFailure({ kind: "invalid-username", got: "bob & <co>" }).text).toBe(
      "Invalid username format. Use <code>@username</code> for each assignee (got: bob &amp; &lt;co&gt;)",
    )
  })

  test("generic format error", () => {
    expect(errors.waddFailure({ kind: "invalid-format" }).text).toBe(
      "Invalid command format.\nUsage: <code>!wadd &lt;URL&gt; [@username ...]</code>",
    )
  })

  test("every !wadd error is sent as HTML with previews left alone", () => {
    for (const reply of [
      errors.waddFailure({ kind: "missing-url" }),
      errors.waddFailure({ kind: "username-before-url" }),
      errors.waddFailure({ kind: "url-scheme" }),
      errors.waddFailure({ kind: "url-scheme-with-example" }),
      errors.waddFailure({ kind: "unsupported-url" }),
      errors.waddFailure({ kind: "invalid-username", got: "x" }),
      errors.waddFailure({ kind: "invalid-format" }),
    ]) {
      expect(reply.parseMode).toBe("HTML")
      expect(reply.disableLinkPreview).toBe(false)
    }
  })
})

describe("!wdone", () => {
  test("confirms the removal", () => {
    expect(tasks.taskRemoved(task()).text).toBe(
      `Removed [#1] <a href="${MR_URL}">monorepo/120</a> (added by @dave)`,
    )
  })

  test("quotes an unknown reference exactly as typed, including the hash", () => {
    expect(tasks.taskNotFound("#9")).toEqual({
      text: "Task #9 not found.",
      parseMode: null,
      disableLinkPreview: false,
    })
  })

  test("shows usage when there is no argument", () => {
    expect(errors.wdoneUsage().text).toBe(
      "Usage: <code>!wdone &lt;N or task_id&gt;</code>\n" +
        "Examples: <code>!wdone 1</code>, <code>!wdone #1</code>, or <code>!wdone repo/123</code>",
    )
  })
})

describe("!wassign", () => {
  test("confirms the new assignees", () => {
    expect(tasks.taskAssigned(task(), ["@eve", "@frank"]).text).toBe(
      `[#1] <a href="${MR_URL}">monorepo/120</a> → @eve, @frank`,
    )
  })

  test("has an unassigned form, even though the command cannot reach it", () => {
    expect(tasks.taskAssigned(task(), []).text).toBe(
      `[#1] <a href="${MR_URL}">monorepo/120</a> (unassigned)`,
    )
  })

  test("shows usage when the arguments do not parse", () => {
    expect(errors.wassignUsage().text).toBe(
      "Usage: <code>!wassign &lt;N or task_id&gt; @username [...]</code>\n" +
        "Examples:\n" +
        "• <code>!wassign 1 @alice</code>\n" +
        "• <code>!wassign #1 @alice @bob</code>\n" +
        "• <code>!wassign repo/123 @alice @bob @charlie</code>",
    )
  })
})

describe("escaping", () => {
  test("escapes the task id, the URL and the author", () => {
    const hostile = task({
      taskId: "<b>x</b>",
      url: 'http://x/?a="b"&c',
      createdBy: "@o'brien",
      assignees: ["@a<b>"],
    })

    expect(taskList([hostile]).text).toBe(
      '[#1] <a href="http://x/?a=&quot;b&quot;&amp;c">&lt;b&gt;x&lt;/b&gt;</a> → @a&lt;b&gt; (by @o&#x27;brien)',
    )
  })
})

describe("!wreminder", () => {
  test("says nothing is configured", () => {
    expect(reminders.noReminderConfigured().text).toBe(
      "No reminder configured for this chat.\n\n" +
        "Use <code>!wreminder-set &lt;cron_expression&gt;</code> to set one.\n" +
        "Example: <code>!wreminder-set 0 9 * * *</code> (daily at 9 AM UTC)",
    )
  })

  test("shows the configuration with SQLite's raw timestamps", () => {
    const reminder: Reminder = {
      chatId: -100,
      cronExpression: "0 9 * * *",
      enabled: true,
      createdAt: "2026-01-01 09:00:00",
      updatedAt: "2026-01-02 10:30:00",
    }

    expect(reminders.reminderStatus(reminder).text).toBe(
      "<b>Reminder Configuration</b>\n\n" +
        "Status: ✅ Enabled\n" +
        "Schedule: <code>0 9 * * *</code>\n" +
        "Timezone: UTC\n" +
        "Created: 2026-01-01 09:00:00\n" +
        "Updated: 2026-01-02 10:30:00\n\n" +
        "Use <code>!wreminder-off</code> to disable or <code>!wreminder-remove</code> to delete.",
    )
  })

  test("shows the disabled marker", () => {
    const reminder: Reminder = {
      chatId: -100,
      cronExpression: "0 9 * * *",
      enabled: false,
      createdAt: "2026-01-01 09:00:00",
      updatedAt: "2026-01-02 10:30:00",
    }
    expect(reminders.reminderStatus(reminder).text).toContain("Status: ⏸ Disabled")
  })
})

describe("!wreminder-set", () => {
  test("confirms the schedule", () => {
    expect(reminders.reminderSet("0 9 * * 0-4").text).toBe(
      "✅ Reminder set successfully!\n\n" +
        "Schedule: <code>0 9 * * 0-4</code>\n" +
        "Timezone: UTC\n\n" +
        "You'll receive reminders when there are pending tasks.\n" +
        "Use <code>!wreminder</code> to check status.",
    )
  })

  test("explains the five-field format", () => {
    expect(reminders.invalidCron({ kind: "wrong-field-count" }).text).toBe(
      "❌ Invalid cron expression. Must have 5 parts: minute hour day month day_of_week\n\n" +
        "<b>Format:</b> <code>* * * * *</code>\n" +
        "         ↓ ↓ ↓ ↓ ↓\n" +
        "         │ │ │ │ └─ Day of week (0-6, 0=Mon, 6=Sun)\n" +
        "         │ │ │ └─── Month (1-12)\n" +
        "         │ │ └───── Day (1-31)\n" +
        "         │ └─────── Hour (0-23)\n" +
        "         └───────── Minute (0-59)\n\n" +
        "<b>Examples:</b>\n" +
        "• <code>0 9 * * *</code> - Daily at 9 AM UTC\n" +
        // bot.py sends a bare ampersand here, not &amp;.
        "• <code>0 9,17 * * *</code> - Daily at 9 AM & 5 PM UTC\n" +
        "• <code>0 9 * * 0-4</code> - Weekdays at 9 AM UTC\n" +
        "• <code>0 */4 * * *</code> - Every 4 hours",
    )
  })

  test("names the offending field, quoting APScheduler's wording", () => {
    expect(
      reminders.invalidCron({ kind: "invalid-field", expression: "xyz", field: "minute" }).text,
    ).toBe(
      "❌ Invalid cron expression: Unrecognized expression &quot;xyz&quot; for field &quot;minute&quot;\n\n" +
        "Please check your expression and try again.\n" +
        "Example: <code>!wreminder-set 0 9 * * *</code>",
    )
  })

  test("reports a scheduling failure", () => {
    expect(reminders.reminderSetFailed().text).toBe(
      "❌ Error setting reminder. Please try again later.",
    )
  })
})

describe("!wreminder-off and !wreminder-remove", () => {
  test("disabling with nothing configured", () => {
    expect(reminders.noReminderToDisable().text).toBe(
      "No reminder configured for this chat.\n" +
        "Use <code>!wreminder-set &lt;cron_expression&gt;</code> to set one.",
    )
  })

  test("disabling succeeded", () => {
    expect(reminders.reminderDisabled().text).toBe(
      "⏸ Reminder disabled.\n\n" +
        "Your configuration is saved. Use <code>!wreminder-set &lt;cron_expression&gt;</code> to re-enable.",
    )
  })

  test("removing with nothing configured is the short sentence", () => {
    expect(reminders.noReminderToRemove().text).toBe("No reminder configured for this chat.")
  })

  test("removing succeeded", () => {
    expect(reminders.reminderRemoved().text).toBe(
      "🗑 Reminder configuration deleted.\n\n" +
        "Use <code>!wreminder-set &lt;cron_expression&gt;</code> to create a new one.",
    )
  })
})

describe("!whelp", () => {
  test("is sent as HTML", () => {
    expect(help().parseMode).toBe("HTML")
    expect(help().disableLinkPreview).toBe(false)
  })

  test("opens and closes exactly as bot.py had it", () => {
    expect(help().text.startsWith("<b>Work Queue Commands</b>\n\n")).toBe(true)
    expect(help().text.endsWith("<b>Day of week:</b> 0=Monday, 1=Tuesday, ..., 6=Sunday")).toBe(
      true,
    )
  })

  test("documents every command", () => {
    for (const fragment of [
      "<code>!wadd &lt;URL&gt; [@username ...]</code>",
      "<code>!w</code>",
      "<code>!wdone &lt;N or task_id&gt;</code>",
      "<code>!wassign &lt;N or task_id&gt; @username [...]</code>",
      "<code>!wreminder-set &lt;cron_expression&gt;</code>",
      "<code>!wreminder</code>",
      "<code>!wreminder-off</code>",
      "<code>!wreminder-remove</code>",
      "<code>!whelp</code>",
    ]) {
      expect(help().text).toContain(fragment)
    }
  })

  test("is the same length as the original, catching a truncated transcription", () => {
    expect(help().text).toHaveLength(1632)
  })
})
