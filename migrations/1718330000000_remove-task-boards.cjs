/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.dropIndex('tasks', 'board_id', { name: 'tasks_board_id_idx' })
  pgm.dropColumn('tasks', 'board_id')
  pgm.dropTable('task_boards')
}

exports.down = () => {
  throw new Error('Irreversible migration')
}
