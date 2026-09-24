/* eslint-disable @typescript-eslint/no-require-imports */

const sharp = require('sharp')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const startDir = process.argv[2] || 'public'
const endDir = process.argv[3] || '.next/standalone/public'

// Maps source image path -> { hash, output }. Lets us skip images that were
// already compressed in a previous run (CI restores endDir + manifest from cache).
const manifestPath = `${endDir}.manifest.json`

const readManifest = () => {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return {}
  }
}

const listFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const fullPath = `${dir}/${dirent.name}`
    return dirent.isDirectory() ? listFiles(fullPath) : [fullPath]
  })

const hashFile = (filePath) => crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex')

const processImage = async (sourcePath) => {
  const output = path.relative(startDir, sourcePath).replace(/\.(jpe?g|png)$/i, '.webp')
  const endPath = `${endDir}/${output}`

  fs.mkdirSync(path.dirname(endPath), { recursive: true })

  await sharp(sourcePath)
    .rotate()
    .webp({ quality: 80 })
    .toFile(endPath)
    .catch((err) => {
      console.error('Error compressing image', sourcePath, err)
    })

  return output
}

const runWithConcurrency = async (items, limit, fn) => {
  const queue = [...items]
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      await fn(queue.shift())
    }
  })
  await Promise.all(workers)
}

const compressImages = async () => {
  const oldManifest = readManifest()
  const newManifest = {}
  const toProcess = []

  for (const sourcePath of listFiles(`${startDir}/images`)) {
    const hash = hashFile(sourcePath)
    const cached = oldManifest[sourcePath]
    if (cached && cached.hash === hash && fs.existsSync(`${endDir}/${cached.output}`)) {
      newManifest[sourcePath] = cached
    } else {
      toProcess.push({ sourcePath, hash })
    }
  }

  // Remove outputs whose source image was deleted or renamed
  for (const [sourcePath, { output }] of Object.entries(oldManifest)) {
    if (!newManifest[sourcePath] && !toProcess.some((item) => item.sourcePath === sourcePath)) {
      fs.rmSync(`${endDir}/${output}`, { force: true })
    }
  }

  console.log(`Compressing ${toProcess.length} images (${Object.keys(newManifest).length} unchanged)`)

  await runWithConcurrency(toProcess, os.cpus().length, async ({ sourcePath, hash }) => {
    const output = await processImage(sourcePath)
    newManifest[sourcePath] = { hash, output }
  })

  fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2))
}

const main = async () => {
  fs.mkdirSync(endDir, { recursive: true })
  await compressImages()

  console.log('Copying other public folder items')
  fs.readdirSync(startDir, { withFileTypes: true }).forEach((dirent) => {
    if (dirent.name === 'images') {
      return
    }
    // Clear first so files deleted from public/ don't linger in a cached endDir
    fs.rmSync(`${endDir}/${dirent.name}`, { recursive: true, force: true })
    fs.cpSync(`${startDir}/${dirent.name}`, `${endDir}/${dirent.name}`, { recursive: true })
  })
}

main()
