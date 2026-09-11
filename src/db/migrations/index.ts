import type { Migration } from "../migrator.ts"
import { baseline } from "./001-baseline.ts"
import { pruneOrphanAssignees } from "./002-prune-orphan-assignees.ts"
import { backfillAssignees } from "./003-backfill-assignees.ts"

/** Ordered by version. Never renumber or reorder an entry that has shipped. */
export const MIGRATIONS: readonly Migration[] = [baseline, pruneOrphanAssignees, backfillAssignees]
