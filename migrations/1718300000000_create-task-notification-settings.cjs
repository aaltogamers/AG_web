/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('task_notification_settings', {
    chat_id: { type: 'text', notNull: true },
    tg_user_id: { type: 'text', notNull: true },
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

  pgm.addConstraint('task_notification_settings', 'task_notification_settings_pk', {
    primaryKey: ['chat_id', 'tg_user_id'],
  })
}

exports.down = (pgm) => {
  pgm.dropTable('task_notification_settings')
}
