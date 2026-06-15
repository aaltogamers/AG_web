/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.dropTable('hidden_task_boards', { cascade: true })
  pgm.dropTable('task_notification_settings', { cascade: true })
  pgm.dropTable('task_assignees', { cascade: true })
  pgm.dropTable('tasks', { cascade: true })
  pgm.dropTable('task_boards', { cascade: true })

  pgm.createTable('task_boards', {
    id: { type: 'bigserial', primaryKey: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.sql("INSERT INTO task_boards DEFAULT VALUES")

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

  pgm.dropConstraint('tg_users', 'tg_users_chat_user_unique')
  pgm.dropIndex('tg_users', 'chat_id', { name: 'tg_users_chat_id_idx' })
  pgm.dropColumn('tg_users', 'chat_id')
  pgm.addConstraint('tg_users', 'tg_users_tg_user_id_unique', {
    unique: ['tg_user_id'],
  })

  pgm.createTable('task_notification_settings', {
    tg_user_id: { type: 'text', notNull: true, primaryKey: true },
    deadline_days: { type: 'integer', notNull: true, default: 5 },
    start_date_days: { type: 'integer', notNull: true, default: 0 },
    notify_creation: { type: 'boolean', notNull: true, default: true },
    notify_before_deadline: { type: 'boolean', notNull: true, default: true },
    notify_before_start: { type: 'boolean', notNull: true, default: true },
    notify_on_deadline: { type: 'boolean', notNull: true, default: true },
    notify_on_start: { type: 'boolean', notNull: true, default: true },
    notify_past_deadline: { type: 'boolean', notNull: true, default: true },
    notify_past_start: { type: 'boolean', notNull: true, default: true },
    skip_in_progress: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })
}

exports.down = () => {
  throw new Error('Irreversible migration')
}
