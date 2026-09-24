/* eslint-disable camelcase */

// Replace the single `maxparticipants` limit with named participant pools.
// Existing events get one "Participants" pool with the old limit, and existing
// sign-ups are placed in it.

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('signup_events', {
    // Array of { id:int, name, size }
    pools: { type: 'jsonb', notNull: true, default: '[]' },
  })
  pgm.sql(`
    UPDATE signup_events
    SET pools = jsonb_build_array(
      jsonb_build_object('id', 1, 'name', 'Participants', 'size', maxparticipants)
    )
  `)
  pgm.dropColumn('signup_events', 'maxparticipants')

  pgm.addColumn('signups', {
    pool_id: { type: 'integer', notNull: true, default: 1 },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('signups', 'pool_id')
  pgm.addColumn('signup_events', {
    maxparticipants: { type: 'integer', notNull: true, default: 0 },
  })
  pgm.sql(`
    UPDATE signup_events
    SET maxparticipants = COALESCE((
      SELECT SUM((p->>'size')::int) FROM jsonb_array_elements(pools) p
    ), 0)
  `)
  pgm.dropColumn('signup_events', 'pools')
}
