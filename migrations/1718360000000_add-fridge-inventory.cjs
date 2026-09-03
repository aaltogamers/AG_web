exports.up = (pgm) => {
  pgm.createTable('fridge_catalog_items', {
    id: 'id',
    name: { type: 'text', notNull: true },
    price_cents: { type: 'integer', notNull: true },
    photo: { type: 'text' },
    archived: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createTable('fridge_users', {
    id: 'id',
    name: { type: 'text', notNull: true },
    photo: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createTable('fridge_transactions', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'fridge_users(id)',
    },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('purchase', 'payment')",
    },
    item_id: {
      type: 'integer',
      references: 'fridge_catalog_items(id)',
    },
    quantity: { type: 'integer' },
    amount_cents: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  })

  pgm.createIndex('fridge_transactions', 'user_id')
}

exports.down = (pgm) => {
  pgm.dropTable('fridge_transactions')
  pgm.dropTable('fridge_users')
  pgm.dropTable('fridge_catalog_items')
}
