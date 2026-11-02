/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumns('tournaments', {
    source: { type: 'text', notNull: true, default: 'local' },
    challengermode_id: { type: 'uuid' },
  })
  pgm.addConstraint('tournaments', 'tournaments_source_check', {
    check: "source IN ('local', 'challengermode')",
  })
  pgm.addConstraint('tournaments', 'tournaments_challengermode_id_check', {
    check: "(source = 'challengermode') = (challengermode_id IS NOT NULL)",
  })
}

exports.down = (pgm) => {
  pgm.dropConstraint('tournaments', 'tournaments_challengermode_id_check')
  pgm.dropConstraint('tournaments', 'tournaments_source_check')
  pgm.dropColumns('tournaments', ['source', 'challengermode_id'])
}
