import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }
  preload() {
    this.load.image('background', '/images/games/midlane.webp')
    this.load.image('teemo', '/images/games/teemo.png')
    this.load.image('alistar', '/images/games/alistar.png')
  }
  create() {
    this.scene.start('Preloader')
  }
}
