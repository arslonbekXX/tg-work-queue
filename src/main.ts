import { createBot, installCommands } from "@bot/bot.ts"
import { loadEnv } from "@config/env.ts"
import { databasePath, openDatabase } from "@db/connection.ts"
import { MIGRATIONS } from "@db/migrations/index.ts"
import { runMigrations } from "@db/migrator.ts"
import { CronScheduler } from "@scheduler/cron.scheduler.ts"
import { createLogger } from "@shared/logger.ts"
import { GrammyNotifier } from "@telegram/grammy.notifier.ts"
import { createContainer } from "./app/container.ts"
import { installLifecycle } from "./app/lifecycle.ts"

const env = loadEnv()
const logger = createLogger("bot", { minLevel: env.logLevel })

const db = openDatabase(databasePath(env.dataDir))
runMigrations(db, MIGRATIONS, logger.child("db"))

const bot = createBot(env.botToken, env.heartbeatPath, logger)
const scheduler = new CronScheduler(logger.child("scheduler"))

const container = createContainer({
  db,
  notifier: new GrammyNotifier(bot.api),
  scheduler,
  logger,
})

installCommands(bot, container.commands, logger)

container.reminders.restoreAll()
logger.info("Reminder scheduler initialized")

installLifecycle({ bot, db, scheduler, logger })

logger.info("Starting bot...")
await bot.start()
