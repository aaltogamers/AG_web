/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('polls', {
    id: { type: 'bigserial', primaryKey: true },
    question: { type: 'text', notNull: true },
    options: { type: 'text[]', notNull: true, default: '{}' },
    is_visible: { type: 'boolean', notNull: true, default: false },
    is_votable: { type: 'boolean', notNull: true, default: false },
    correct_option: { type: 'text' },
    points_for_win: { type: 'integer' },
    additional_message: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('votes', {
    id: { type: 'bigserial', primaryKey: true },
    poll_id: {
      type: 'bigint',
      notNull: true,
      references: 'polls',
      onDelete: 'CASCADE',
    },
    picked_option: { type: 'text', notNull: true },
    user_name: { type: 'text', notNull: true },
    points: { type: 'integer' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.addConstraint('votes', 'votes_poll_user_unique', {
    unique: ['poll_id', 'user_name'],
  })

  pgm.createIndex('votes', 'poll_id', { name: 'votes_poll_id_idx' })
  pgm.createIndex('votes', 'user_name', { name: 'votes_user_name_idx' })
}

exports.down = (pgm) => {
  pgm.dropTable('votes')
  pgm.dropTable('polls')
}
