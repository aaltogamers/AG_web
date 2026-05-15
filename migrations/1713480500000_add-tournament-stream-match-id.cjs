/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('tournaments', {
    stream_match_id: { type: 'integer' },
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('tournaments', 'stream_match_id')
}
