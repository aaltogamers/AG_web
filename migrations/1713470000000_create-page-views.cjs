/* eslint-disable camelcase */

exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.createTable('page_views', {
    id: { type: 'bigserial', primaryKey: true },
    path: { type: 'text', notNull: true },
    ts: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('page_views', ['path', { name: 'ts', sort: 'DESC' }], {
    name: 'page_views_path_ts_idx',
  })

  pgm.createIndex('page_views', [{ name: 'ts', sort: 'DESC' }], {
    name: 'page_views_ts_idx',
  })
}

exports.down = (pgm) => {
  pgm.dropTable('page_views')
}
