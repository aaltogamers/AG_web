/* eslint-disable camelcase */

// Sign-ups now belong to a time & place of an event, identified by
// `eventSlug:sessionId` instead of the event name. Old sign-ups are dropped.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.sql('TRUNCATE signups, signup_events')
  pgm.renameColumn('signup_events', 'name', 'signup_key')
}

exports.down = (pgm) => {
  pgm.renameColumn('signup_events', 'signup_key', 'name')
}
