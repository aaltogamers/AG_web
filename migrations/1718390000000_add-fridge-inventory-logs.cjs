exports.up = (pgm) => {
  pgm.createTable('fridge_inventory_logs', {
    id: 'id',
    event: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('fridge_inventory_logs', 'created_at')
}

exports.down = (pgm) => {
  pgm.dropTable('fridge_inventory_logs')
}
