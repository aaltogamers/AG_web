/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('mapban_info', {
    id: { type: 'integer', primaryKey: true, default: 1 },
    team1: { type: 'text', notNull: true, default: '' },
    team2: { type: 'text', notNull: true, default: '' },
    game: { type: 'text', notNull: true, default: 'CS 2' },
  })

  pgm.addConstraint('mapban_info', 'mapban_info_singleton', {
    check: 'id = 1',
  })

  pgm.sql(
    `INSERT INTO mapban_info (id, team1, team2, game) VALUES (1, '', '', 'CS 2') ON CONFLICT (id) DO NOTHING`
  )

  pgm.createTable('mapbans', {
    id: { type: 'bigserial', primaryKey: true },
    map: { type: 'text', notNull: true, unique: true },
    type: { type: 'text', notNull: true },
    team: { type: 'text', notNull: true },
    idx: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.addConstraint('mapbans', 'mapbans_type_check', {
    check: "type IN ('ban', 'pick', 'decider')",
  })

  pgm.addConstraint('mapbans', 'mapbans_team_check', {
    check: "team IN ('team1', 'team2')",
  })
}

exports.down = (pgm) => {
  pgm.dropTable('mapbans')
  pgm.dropTable('mapban_info')
}
