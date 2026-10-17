// Moves uploaded post images from the post_media.data column to mediaStore,
// keeping their ids. Run once after deploying, with the production DATABASE_URL,
// MEDIA_STORAGE_CONNECTION_STRING and NODE_ENV=production (for SSL):
//   npm run move-post-media
// Safe to run again: it only moves rows that still have data.
import pool, { ensureMigrated } from '../src/utils/db_pg'
import { uploadPostImage } from '../src/utils/mediaStore'

const main = async () => {
  await ensureMigrated()
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM post_media WHERE data IS NOT NULL')
  console.log(`Moving ${rows.length} images`)
  for (const { id } of rows) {
    const result = await pool.query<{ data: Buffer | null }>('SELECT data FROM post_media WHERE id = $1', [id])
    const data = result.rows[0]?.data
    if (!data) continue
    await uploadPostImage(data, id)
    await pool.query('UPDATE post_media SET data = NULL WHERE id = $1', [id])
    console.log(`Moved ${id}`)
  }
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
