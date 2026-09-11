# Telegram Work Queue Bot

A Telegram bot that manages task queues for GitLab/GitHub merge requests in groups, with automatic cron-based reminders.

## Commands

### Task Management

| Command | Description |
|---------|-------------|
| `!wadd <MR/PR URL> [@username ...]` | Add a merge request (optionally assign to one or more users) |
| `!w` | List all tasks in the queue |
| `!wdone <N or task_id>` | Remove a task by sequence number or task ID |
| `!wassign <N or task_id> @username [...]` | Assign or reassign a task (replaces all existing assignees) |
| `!whelp` | Show help instructions |

### Reminders

| Command | Description |
|---------|-------------|
| `!wreminder-set <cron_expression>` | Set automatic reminder with cron schedule (UTC time) |
| `!wreminder` | Show current reminder configuration |
| `!wreminder-off` | Disable reminder (keeps configuration) |
| `!wreminder-remove` | Delete reminder configuration |

## Task IDs

Task IDs are derived from the merge request URL:

| URL | Task ID |
|-----|---------|
| `http://gitlab.example.com/group/monorepo/-/merge_requests/120` | `monorepo/120` |
| `https://github.com/owner/repo/pull/45` | `repo/45` |

## Setup

### 1. Create a Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy the bot token provided

### 2. Configure Environment

Create a `.env` file with your bot token:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Install Dependencies

Requires [Bun](https://bun.com) 1.4 or newer.

```bash
bun install
```

This includes:
- `grammy` - Telegram Bot API framework
- `croner` - Cron-based reminder scheduling

SQLite comes from Bun itself (`bun:sqlite`), and Bun reads `.env` natively, so
neither needs a dependency.

### 4. Run the Bot

#### Option A: Run Directly

```bash
bun run start
```

#### Option B: Run with Docker

```bash
# Build the image
docker-compose build

# Start the bot
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the bot
docker-compose down
```

### 5. Add Bot to Group

1. Add the bot to your Telegram group
2. Make the bot an **admin** with "Post Messages" permission
3. Start using commands!

> **Note:** commands only work in groups and direct messages. The bot does not
> respond to channel posts or to edited messages.

## Usage Examples

### Task Management

```
# Add a task without assignee
!wadd http://gitlab.example.com/group/monorepo/-/merge_requests/120

# Response:
# [#1] monorepo/120

# Add a task with single assignee
!wadd http://gitlab.example.com/group/monorepo/-/merge_requests/120 @alice

# Response:
# [#1] monorepo/120 → @alice

# Add a task with multiple assignees
!wadd http://gitlab.example.com/group/monorepo/-/merge_requests/120 @alice @bob @charlie

# Response:
# [#1] monorepo/120 → @alice, @bob, @charlie

# List all tasks
!w

# Response:
# [#1] monorepo/120 → @alice, @bob (by @dave)
# [#2] backend/45 (by @dave)

# Assign or reassign a task (replaces all existing assignees)
!wassign 1 @eve
# Or with # prefix:
!wassign #1 @eve @frank

# Response:
# [#1] monorepo/120 → @eve, @frank

# Mark task as done (by number or task ID)
!wdone 1
# Or with # prefix:
!wdone #1

# Response:
# Removed [#1] monorepo/120 (added by @dave)

# Or by task ID:
!wdone backend/45
```

### Reminders

```
# Set daily reminder at 9 AM UTC
!wreminder-set 0 9 * * *

# Response:
# ✅ Reminder set successfully!
# Schedule: 0 9 * * *
# Timezone: UTC

# Set weekday reminders at 9 AM and 5 PM UTC
!wreminder-set 0 9,17 * * 0-4

# Check current configuration
!wreminder

# Response:
# Reminder Configuration
# Status: ✅ Enabled
# Schedule: 0 9 * * *
# Timezone: UTC

# Disable reminder temporarily
!wreminder-off

# Delete reminder configuration
!wreminder-remove
```

## Supported URLs

- **GitLab**: `http://host/group/project/-/merge_requests/N`
- **GitHub**: `https://github.com/owner/repo/pull/N`

## Cron Expression Format

Reminders use 5-part cron expressions in UTC timezone:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, 0=Monday, 1=Tuesday, ..., 6=Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Note:** Day of week uses 0=Monday (not Sunday like standard cron).

### Examples:

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Daily at 9:00 AM UTC |
| `0 9,17 * * *` | Daily at 9:00 AM and 5:00 PM UTC |
| `0 9 * * 0-4` | Weekdays (Mon-Fri) at 9:00 AM UTC |
| `0 9 * * 5,6` | Weekends (Sat, Sun) at 9:00 AM UTC |
| `0 */4 * * *` | Every 4 hours |
| `*/30 9-17 * * *` | Every 30 minutes between 9 AM-5 PM UTC |
| `0 0 * * 6` | Every Sunday at midnight UTC |

**Timezone Note:** Calculate your local time to UTC. For example, if you're in GMT+5 and want 9 AM local time, use `0 4 * * *` (4 AM UTC).

## Reminder Behavior

- Reminders are sent only when there are **pending tasks** in the queue
- Each chat can have its own independent reminder schedule
- Reminders persist across bot restarts
- You can temporarily disable reminders without losing the configuration

## Features

- **Multiple Assignees**: Assign tasks to multiple team members
- **Isolated Queues**: Each chat has its own independent task queue
- **Unique Tasks**: Task IDs are unique per chat (same MR can't be added twice)
- **Clickable Links**: Tasks are displayed as clickable links to the MR/PR
- **Custom Reminders**: Each chat can configure its own reminder schedule
- **Persistent Storage**: Data is stored in a SQLite database (`workqueue.db`)
- **Flexible Assignment**: Reassign tasks at any time, replacing all existing assignees

## Notes

- **Task Assignment**: Use `!wassign` to change assignees - this replaces all existing assignees with the new ones
- **Task Removal**: When a task is removed, all its assignees are automatically cleaned up
- **Migration**: Existing single-assignee tasks are automatically migrated to support multiple assignees on first run

## Development

```bash
bun run dev         # watch mode
bun test            # the whole suite
bun run typecheck   # tsc --noEmit
bun run lint        # Biome: lint and format check
bun run format      # Biome: apply fixes
bun run check       # typecheck + lint + test, as CI runs them
```

### Layout

```
src/
├── main.ts       entrypoint: environment, database, wiring, signals
├── app/          composition root, shutdown, Docker healthcheck
├── config/       environment parsing
├── shared/       logger, HTML escaping, Result — depends on nothing
├── domain/       pure logic: URL parsing, assignees, task refs, cron translation
├── db/           bun:sqlite, migrations, repositories
├── telegram/     the Notifier port and its grammY implementation
├── scheduler/    the ReminderScheduler port and its croner implementation
├── services/     use cases
└── bot/          routing, commands, and every user-visible string in views/
```

Each layer may only import from the ones below it. `src/architecture.test.ts`
enforces that by reading the imports; Biome separately bans `grammy`, `croner`
and `bun:sqlite` from the layers that must stay framework-free.

Two rules worth knowing before you change anything:

- **Every user-visible string lives in `src/bot/views/`.** `views.test.ts`
  pins them to what the bot said before the TypeScript rewrite.
- **Never `await` inside a `db.transaction()` callback.** `bun:sqlite` is
  synchronous, so repositories are synchronous and services are async.

### Database

The schema has not changed since the Python version and a database created by
either is byte-identical; `src/db/migrator.test.ts` asserts that. Schema
version is tracked in `PRAGMA user_version` rather than a table, so no extra
table appears in an existing database.

### Reminder schedules

Day-of-week numbering is Monday-first, which is what APScheduler used and what
the table above documents. `src/domain/cron/day-of-week.ts` translates it to
the Sunday-first numbering `croner` expects, so stored schedules keep their
original meaning.
