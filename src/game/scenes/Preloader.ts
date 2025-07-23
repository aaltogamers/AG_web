import { Scene } from 'phaser'
import { characterNames } from '../constants'
import { getState, isHost, myPlayer, onPlayerJoin, PlayerState, setState } from 'playroomkit'

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
      if (isHost()) {
        const alivePlayers = getState('alivePlayers')
        setState('alivePlayers', alivePlayers.concat(player.id))
      }
    })
  }
  create() {
    const nextButton = this.add.rectangle(600, 600, 100, 50, 0).setInteractive()
    characterNames.forEach((name, i) => {
      const button = this.add
        .image(200 * (1 + i - 5 * Math.floor(i / 5)), 200 * (1 + Math.floor(i / 5)), name)
        .setScale(0.25)
        .setInteractive()
      button.on('pointerup', () => {
        this.selected = i
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
    this.characterOutline?.setPosition(
      200 * (1 + this.selected - 5 * Math.floor(this.selected / 5)),
      200 * (1 + Math.floor(this.selected / 5))
    )
    if (
      this.players.filter((player) => player.getState('ready') == true).length ==
      this.players.length
    ) {
      this.scene.start('MainMenu')
    }
  }
}
