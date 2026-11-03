/* eslint-disable camelcase */

// Automatic approval requests and image reminders of unapproved posts (social/reminders.ts)

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('posts', {
    approval_requested_at: { type: 'timestamptz' },
    image_reminded_at: { type: 'timestamptz' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('posts', ['approval_requested_at', 'image_reminded_at'])
}
