exports.up = (pgm) => {
  pgm.addColumn('fridge_catalog_items', {
    sort_order: { type: 'integer', notNull: true, default: 0 },
  })
  pgm.sql(`
    UPDATE fridge_catalog_items
    SET sort_order = sub.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
      FROM fridge_catalog_items
    ) sub
    WHERE fridge_catalog_items.id = sub.id
  `)
}

exports.down = (pgm) => {
  pgm.dropColumn('fridge_catalog_items', 'sort_order')
}
