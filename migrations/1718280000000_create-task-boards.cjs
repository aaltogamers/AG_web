/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('task_boards', {
    id: { type: 'bigserial', primaryKey: true },
    chat_id: { type: 'text', notNull: true, unique: true },
    name: { type: 'text', notNull: true, default: "'Task Board'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('tasks', {
    id: { type: 'bigserial', primaryKey: true },
    board_id: {
      type: 'bigint',
      notNull: true,
      references: 'task_boards',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    deadline: { type: 'timestamptz' },
    start_time: { type: 'timestamptz' },
    state: {
      type: 'text',
      notNull: true,
      default: "'todo'",
      check: "state IN ('todo', 'in_progress', 'done')",
    },
    created_by_tg_id: { type: 'text' },
    created_by_tg_name: { type: 'text' },
    position: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('tasks', 'board_id', { name: 'tasks_board_id_idx' })
  pgm.createIndex('tasks', 'state', { name: 'tasks_state_idx' })

  pgm.createTable('task_assignees', {
    task_id: {
      type: 'bigint',
      notNull: true,
      references: 'tasks',
      onDelete: 'CASCADE',
    },
    tg_user_id: { type: 'text', notNull: true },
    tg_user_name: { type: 'text', notNull: true },
  })

  pgm.addConstraint('task_assignees', 'task_assignees_pk', {
    primaryKey: ['task_id', 'tg_user_id'],
  })
}

exports.down = (pgm) => {
  pgm.dropTable('task_assignees')
  pgm.dropTable('tasks')
  pgm.dropTable('task_boards')
}
