import { Scene } from 'phaser'

export class Preloader extends Scene {
  constructor() {
    super('Preloader')
  }
  init() {
    this.add.image(800, 600, 'background')
  }
  create() {
    this.scene.start('MainMenu')
  }
}
