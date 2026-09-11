exports.up = (pgm) => {
  pgm.addColumn('tasks', {
    ai_context: { type: 'text', default: null },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('tasks', 'ai_context')
}
