/* eslint-disable camelcase */

// Events are in the database (events table), so a website change records the
// event's version it saved instead of a git commit

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.dropColumn('post_website_changes', 'commit_sha')
  pgm.addColumn('post_website_changes', { event_version: { type: 'integer' } })
}

exports.down = (pgm) => {
  pgm.dropColumn('post_website_changes', 'event_version')
  pgm.addColumn('post_website_changes', { commit_sha: { type: 'text' } })
}
