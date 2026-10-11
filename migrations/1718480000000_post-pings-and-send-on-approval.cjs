/* eslint-disable camelcase */

// Discord pings of a post's message, and posts that are sent when approved

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('post_targets', {
    // Discord: 'here', 'everyone' or role ids
    pings: { type: 'jsonb', notNull: true, default: '[]' },
  })
  pgm.addColumn('posts', {
    // send_at is set to the approval time when the post is approved
    send_on_approval: { type: 'boolean', notNull: true, default: false },
  })
  // Instagram channels no longer have the "link in bio" option
  pgm.sql("UPDATE social_channels SET config = config - 'linkInBio' WHERE platform = 'instagram'")
}

exports.down = (pgm) => {
  pgm.dropColumn('post_targets', 'pings')
  pgm.dropColumn('posts', 'send_on_approval')
}
