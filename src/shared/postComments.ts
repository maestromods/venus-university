import { globalSlotOf } from './jobs'
import type { TimeSlot } from './types'

/**
 * The replies under a post on the feed.
 *
 * The lines themselves are the model's: they arrive with the post, in the same call that writes
 * it and describes its picture, because a canned line cannot answer what she actually posted.
 * What is rolled here is only how many of them the post keeps, and when each one turns up.
 */

/** One reply under a post. */
export interface PostComment {
  /** crypto.randomUUID(); the list key. */
  id: string
  handle: string
  emoji: string
  text: string
  /**
   * The global slot it appears in, which is the post's own or one of the two after it. Every
   * comment is rolled when the post is filed and then kept back until its slot arrives, so a
   * post picks up replies over the day rather than arriving finished.
   */
  at: number
}

/** How many replies past the ones her friends leave; the same spread the likes roll uses. */
const COMMENT_SPREAD = 4

/**
 * How many replies a post keeps: one for each girl she is close to, plus up to three others.
 *
 * Deliberately the shape of `rollPostLikes` rather than something of its own — a post's replies
 * and its likes are the same crowd — and deliberately blind to whether it carries a picture. A
 * photograph changes what the replies *say*, which is the model's business, not how many there
 * are.
 */
export function rollCommentCount(friendsCount: number, rand: () => number = Math.random): number {
  return friendsCount + Math.floor(rand() * COMMENT_SPREAD)
}

/**
 * The comments that have arrived by now. They are all rolled when the post is filed — the call
 * that could answer the post is long over by the time the later ones show — but each carries the
 * slot it turns up in, so the thread grows while the day does.
 */
export function shownComments(
  comments: readonly PostComment[] | undefined,
  date: number,
  time: TimeSlot
): PostComment[] {
  if (!comments) return []
  const now = globalSlotOf(date, time)
  return comments.filter((comment) => comment.at <= now)
}
