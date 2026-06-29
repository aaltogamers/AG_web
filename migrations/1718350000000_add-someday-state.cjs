/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_state_check`)
  pgm.sql(
    `ALTER TABLE tasks ADD CONSTRAINT tasks_state_check CHECK (state IN ('someday', 'todo', 'in_progress', 'done'))`
  )
}

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_state_check`)
  pgm.sql(
    `ALTER TABLE tasks ADD CONSTRAINT tasks_state_check CHECK (state IN ('todo', 'in_progress', 'done'))`
  )
}
