/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('tournament_stream_configs', {
    id: { type: 'bigserial', primaryKey: true },
    tournament_id: {
      type: 'bigint',
      notNull: true,
      references: 'tournaments',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    // Query string portion (without leading "?"), e.g. "stream&stage=winners&textColor=ffffff".
    query: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.addConstraint('tournament_stream_configs', 'tournament_stream_configs_unique_name', {
    unique: ['tournament_id', 'name'],
  })

  pgm.createIndex('tournament_stream_configs', 'tournament_id', {
    name: 'tournament_stream_configs_tournament_id_idx',
  })
}

exports.down = (pgm) => {
  pgm.dropTable('tournament_stream_configs')
}
