import { describe, expect, it } from 'vitest'
import { rollCommentCount, shownComments, type PostComment } from '../src/shared/postComments'

/**
 * The comment lines are the model's; what is rolled is how many a post keeps and when each turns
 * up. Both are checked against a fixed `rand`, since a spread tested by sampling is a flaky test.
 */
describe('rollCommentCount', () => {
  it('gives every girl she is close to a reply', () => {
    expect(rollCommentCount(4, () => 0)).toBe(4)
  })

  it('adds up to three more, and never a fourth', () => {
    expect(rollCommentCount(0, () => 0)).toBe(0)
    expect(rollCommentCount(0, () => 0.99)).toBe(3)
  })
})

describe('shownComments', () => {
  const at = (slot: number): PostComment => ({
    id: `c${slot}`,
    handle: 'someone',
    emoji: '🙂',
    text: 'hi',
    at: slot
  })

  it('holds back a reply whose slot has not arrived', () => {
    // Day 0, slot 0 is global slot 0; a reply stamped later is not shown yet.
    const said = shownComments([at(0), at(99)], 0, 0)
    expect(said).toHaveLength(1)
    expect(said[0].at).toBe(0)
  })

  it('answers nothing where a post has no replies', () => {
    expect(shownComments(undefined, 0, 0)).toEqual([])
  })
})
