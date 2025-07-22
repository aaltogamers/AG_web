import { Scene } from 'phaser'
import { characterNames } from '../constants'
import { myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'

export class Preloader extends Scene {
  selected: number = 1
  players: PlayerState[] = [myPlayer()]
  characterButtons: Phaser.GameObjects.Image[] = []
  characterOutline: Phaser.GameObjects.Arc | null = null
  constructor() {
    super('Preloader')
  }
  init() {
    this.add.image(800, 600, 'background')
    this.characterOutline = this.add.circle(200, 200, 100, 0xff0000)
    onPlayerJoin((player) => {
      if (player.id != myPlayer().id) {
        this.players.push(player)
      }
    })
  }
  create() {
    const nextButton = this.add.rectangle(600, 400, 100, 50, 0).setInteractive()
    characterNames.forEach((name, i) => {
      const button = this.add
        .image(200 * (1 + i), 200, name)
        .setScale(0.3)
        .setInteractive()
      button.on('pointerup', () => {
        this.selected = i
        console.log(name)
      })
      this.characterButtons.push(button)
    })

    nextButton.on('pointerup', () => {
      myPlayer().setState('character', characterNames[this.selected])
      myPlayer().setState('ready', true)
      nextButton.setFillStyle(0x00ff00)
    })
  }

  update() {
    this.characterOutline?.setPosition(200 * (1 + this.selected), 200)
    if (
      this.players.filter((player) => player.getState('ready') == true).length ==
      this.players.length
    ) {
      this.scene.start('MainMenu')
    }
  }
}
