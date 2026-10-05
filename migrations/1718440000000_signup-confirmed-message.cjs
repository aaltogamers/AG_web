/* eslint-disable camelcase */

// A message and a link shown to participants who got a place (not those on a
// reserve list), e.g. a link to the event's Telegram group

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('signup_events', {
    confirmed_message: { type: 'text', notNull: true, default: '' },
    confirmed_link: { type: 'text', notNull: true, default: '' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('signup_events', ['confirmed_message', 'confirmed_link'])
}
