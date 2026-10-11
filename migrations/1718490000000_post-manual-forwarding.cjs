/* eslint-disable camelcase */

// Telegram channels the bot can't post to: the message goes to the review topic
// and someone forwards it by hand

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('post_targets', {
    // Name of the Telegram user who pressed "Forwarded"
    forwarded_by: { type: 'text' },
    forwarded_at: { type: 'timestamptz' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('post_targets', ['forwarded_by', 'forwarded_at'])
}
