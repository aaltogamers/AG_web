/* eslint-disable camelcase */

// When a post's website change runs: on_approval (when the post is approved),
// before_post (the lead time before the first message) or at (run_at)

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('post_website_changes', {
    timing: { type: 'text', notNull: true, default: 'on_approval' },
  })
  // Existing changes keep their times
  pgm.sql(
    "UPDATE post_website_changes SET timing = CASE WHEN run_at IS NULL THEN 'before_post' ELSE 'at' END"
  )
}

exports.down = (pgm) => {
  pgm.dropColumn('post_website_changes', 'timing')
}
