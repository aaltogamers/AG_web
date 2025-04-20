import { Scene } from 'phaser'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }
  preload() {
    this.load.image('background', '/images/games/pnz-frame-1.jpg')
  }
  create() {
    this.scene.start('Preloader')
  }
}
