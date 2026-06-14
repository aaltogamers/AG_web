/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('hidden_task_boards', {
    tg_user_id: { type: 'text', notNull: true },
    chat_id: { type: 'text', notNull: true },
    hidden_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.addConstraint('hidden_task_boards', 'hidden_task_boards_pk', {
    primaryKey: ['tg_user_id', 'chat_id'],
  })
}

exports.down = (pgm) => {
  pgm.dropTable('hidden_task_boards')
}
