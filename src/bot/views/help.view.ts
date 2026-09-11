import { html, type Reply } from "./reply.ts"

/**
 * The `!whelp` body, transcribed verbatim from bot.py. It documents the command
 * surface, so it has to stay in step with README.md.
 */
const HELP_TEXT =
  "<b>Work Queue Commands</b>\n\n<code>!wadd &lt;URL&gt; [@username ...]</code>\nAdd a merge request (optionally assign to one or more users)\nExamples:\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123</code>\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice</code>\n• <code>!wadd http://gitlab.example.com/group/repo/-/merge_requests/123 @alice @bob</code>\n\n<code>!w</code>\nList all tasks in the queue\n\n<code>!wdone &lt;N or task_id&gt;</code>\nRemove a completed task by number or ID\nExamples: <code>!wdone 1</code>, <code>!wdone #1</code>, or <code>!wdone repo/123</code>\n\n<code>!wassign &lt;N or task_id&gt; @username [...]</code>\nAssign or reassign task (replaces all existing assignees)\nExamples: <code>!wassign 1 @alice</code>, <code>!wassign #2 @bob @charlie</code>, or <code>!wassign repo/45 @alice @bob</code>\n\n<code>!wreminder-set &lt;cron_expression&gt;</code>\nSet automatic reminder (5-part cron format, UTC time)\nExamples:\n• <code>!wreminder-set 0 9 * * *</code> (daily at 9 AM UTC)\n• <code>!wreminder-set 0 9,17 * * 0-4</code> (weekdays at 9 AM & 5 PM)\n\n<code>!wreminder</code>\nShow current reminder configuration\n\n<code>!wreminder-off</code>\nDisable reminder (keeps configuration)\n\n<code>!wreminder-remove</code>\nDelete reminder configuration\n\n<code>!whelp</code>\nShow this help message\n\n<b>Supported URLs:</b>\n• GitLab: <code>http://host/group/project/-/merge_requests/N</code>\n• GitHub: <code>https://github.com/owner/repo/pull/N</code>\n\n<b>Cron Format:</b> <code>* * * * *</code> = minute hour day month day_of_week\n<b>Day of week:</b> 0=Monday, 1=Tuesday, ..., 6=Sunday"

export function help(): Reply {
  return html(HELP_TEXT)
}
