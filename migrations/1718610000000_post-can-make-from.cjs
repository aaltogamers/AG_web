/* eslint-disable camelcase */

// Posts that can't be made before a time, nudged then instead of earlier (social/reminders.ts)

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('posts', {
    can_make_from: { type: 'timestamptz' },
    can_make_reminded_at: { type: 'timestamptz' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('posts', ['can_make_from', 'can_make_reminded_at'])
}
