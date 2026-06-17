exports.up = (pgm) => {
  pgm.addColumn('tasks', {
    done_at: { type: 'timestamptz', default: null },
  })
  pgm.sql(`UPDATE tasks SET done_at = updated_at WHERE state = 'done'`)
}

exports.down = (pgm) => {
  pgm.dropColumn('tasks', 'done_at')
}
