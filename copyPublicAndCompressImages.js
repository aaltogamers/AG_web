/* eslint-disable @typescript-eslint/no-require-imports */

const sharp = require('sharp')
const fs = require('fs')

const startDir = process.argv[2] || 'public'
const endDir = process.argv[3] || '.next/standalone/public'

const copyAndCompressFolder = (folder, sourceRoot, endRoot) => {
  fs.mkdirSync(`${endRoot}/${folder}`, { recursive: true })
  fs.readdirSync(`${sourceRoot}/${folder}`, { withFileTypes: true }).forEach((dirent) => {
    const sourcePath = `${sourceRoot}/${folder}/${dirent.name}`
    const endPath = `${endRoot}/${folder}/${dirent.name}`

    if (dirent.isDirectory()) {
      copyAndCompressFolder(`${folder}/${dirent.name}`, sourceRoot, endRoot)
    } else {
      const shouldCompress = folder !== 'patches'

      if (shouldCompress) {
        const endPathWithFileEnding = endPath.replace(/\.(jpe?g|png)$/i, '.webp')
        sharp(sourcePath)
          .rotate()
          .webp({ quality: 80 })
          .toFile(endPathWithFileEnding)
          .catch((err) => {
            console.error('Error compressing image', sourcePath, err)
          })
      } else {
        fs.cpSync(sourcePath, endPath)
      }
    }
  })
}

copyAndCompressFolder('images', startDir, endDir)

console.log('Copying other public folder items')
fs.readdirSync(startDir, { withFileTypes: true }).forEach((dirent) => {
  if (dirent.isDirectory()) {
    if (dirent.name === 'images') {
      return
    }
    fs.cpSync(`${startDir}/${dirent.name}`, `${endDir}/${dirent.name}`, { recursive: true })
  } else {
    fs.cpSync(`${startDir}/${dirent.name}`, `${endDir}/${dirent.name}`)
  }
})
