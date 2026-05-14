/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('tournaments', {
    id: { type: 'bigserial', primaryKey: true },
    slug: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true, unique: true },
    bracket_type: { type: 'text', notNull: true },
    team_count: { type: 'integer', notNull: true },
    // Ordered list of team names; index = seed.
    teams: { type: 'jsonb', notNull: true, default: '[]' },
    // Exported `Database` snapshot from BracketsManager. NULL until the bracket
    // has been built from the settings above.
    data: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
}

exports.down = (pgm) => {
  pgm.dropTable('tournaments')
}
