import { Scene } from 'phaser'
import { characterNames } from '../constants'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }
  preload() {
    this.load.image('background', '/images/games/midlane.webp')
    characterNames.forEach((character) => {
      this.load.image(character, `/images/games/${character}.png`)
    })
  }
  create() {
    this.scene.start('Preloader')
  }
}
