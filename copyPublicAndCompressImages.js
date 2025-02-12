/* eslint-disable @typescript-eslint/no-require-imports */

const sharp = require('sharp')
const fs = require('fs')

const startDir = process.argv[2] || 'public'
const endDir = process.argv[3] || '.next/standalone/public'

//const dataUrls = {}

const copyAndCompressFolder = async (folder, sourceRoot, endRoot) => {
  fs.mkdirSync(`${endRoot}/${folder}`, { recursive: true })
  for await (dirent of fs.readdirSync(`${sourceRoot}/${folder}`, { withFileTypes: true })) {
    const sourcePath = `${sourceRoot}/${folder}/${dirent.name}`
    const endPath = `${endRoot}/${folder}/${dirent.name}`

    if (dirent.isDirectory()) {
      await copyAndCompressFolder(`${folder}/${dirent.name}`, sourceRoot, endRoot)
    } else {
      const shouldCompress = folder !== 'patches'

      const endPathWithFileEnding = endPath.replace(/\.(jpe?g|png)$/i, '.webp')

      if (shouldCompress) {
        await sharp(sourcePath)
          .rotate()
          .webp({ quality: 80 })
          .toFile(endPathWithFileEnding)
          .catch((err) => {
            console.error('Error compressing image', sourcePath, err)
          })

        /*
        const resizedImageBuf = await require('sharp')(sourcePath)
          .resize(16, 16)
          .toFormat('jpeg')
          .toBuffer()

        const dataUrl = `data:image/jpeg;base64,${resizedImageBuf.toString('base64')}`

        dataUrls[endPath] = dataUrl
        */
      } else {
        fs.cpSync(sourcePath, endPath)
      }
    }
  }
}

const main = async () => {
  await copyAndCompressFolder('images', startDir, endDir)

  //fs.writeFileSync(`${endDir}/blurDataUrls.json`, JSON.stringify(dataUrls))

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
}

main()
