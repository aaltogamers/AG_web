import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }
  preload() {
    this.load.image('background', '/images/games/midlane.webp')
    this.load.image('player', '/images/games/teemo.png')
  }
  create() {
    this.scene.start('Preloader')
  }
}
