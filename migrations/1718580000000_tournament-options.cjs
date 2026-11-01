/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('tournaments', {
    options: { type: 'jsonb', notNull: true, default: '{}' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('tournaments', 'options')
}
