/**
 * Both patterns are anchored because Python used `re.match`, which only anchors
 * at the start of the string.
 */
const GITLAB_MERGE_REQUEST = /^https?:\/\/[^/]+\/(?:.+?\/)*([^/]+)\/-\/merge_requests\/(\d+)/
const GITHUB_PULL_REQUEST = /^https?:\/\/github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/

/** Port of `extract_task_id`. Produces `repo/N`, or null for an unsupported host. */
export function extractTaskId(url: string): string | null {
  const gitlab = GITLAB_MERGE_REQUEST.exec(url)
  if (gitlab) return `${gitlab[1]}/${gitlab[2]}`

  const github = GITHUB_PULL_REQUEST.exec(url)
  if (github) return `${github[1]}/${github[2]}`

  return null
}

/** The same check `validate_wadd_args` ran before deciding on an error message. */
export function isSupportedUrl(url: string): boolean {
  return extractTaskId(url) !== null
}
