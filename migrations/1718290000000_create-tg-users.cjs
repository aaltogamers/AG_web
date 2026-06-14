/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('tg_users', {
    id: { type: 'bigserial', primaryKey: true },
    chat_id: { type: 'text', notNull: true },
    tg_user_id: { type: 'text', notNull: true },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text' },
    username: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.addConstraint('tg_users', 'tg_users_chat_user_unique', {
    unique: ['chat_id', 'tg_user_id'],
  })

  pgm.createIndex('tg_users', 'chat_id', { name: 'tg_users_chat_id_idx' })
}

exports.down = (pgm) => {
  pgm.dropTable('tg_users')
}
