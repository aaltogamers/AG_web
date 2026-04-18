/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('signup_events', {
    id: { type: 'bigserial', primaryKey: true },
    name: { type: 'text', notNull: true, unique: true },
    maxparticipants: { type: 'integer', notNull: true, default: 0 },
    openfrom: { type: 'timestamptz', notNull: true },
    openuntil: { type: 'timestamptz', notNull: true },
    // Array of { id:int, title, description?, type, public, required, options?, multi? }
    inputs: { type: 'jsonb', notNull: true, default: '[]' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('signups', {
    id: { type: 'bigserial', primaryKey: true },
    event_id: {
      type: 'bigint',
      notNull: true,
      references: 'signup_events',
      onDelete: 'CASCADE',
    },
    // Keyed by field id, e.g. { "1": "Otju", "3": ["Duelist"] }
    answers: { type: 'jsonb', notNull: true, default: '{}' },
    submission_token: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('signups', 'event_id', { name: 'signups_event_id_idx' })
}

exports.down = (pgm) => {
  pgm.dropTable('signups')
  pgm.dropTable('signup_events')
}
