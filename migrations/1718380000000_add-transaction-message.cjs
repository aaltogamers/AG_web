exports.up = (pgm) => {
  pgm.addColumn('fridge_transactions', {
    message: { type: 'text' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('fridge_transactions', 'message')
}
