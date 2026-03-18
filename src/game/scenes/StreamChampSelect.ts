import { onPlayerJoin, PlayerState, usePlayersList } from 'playroomkit'
import { characterNames } from '../constants'

export class StreamChampSelect extends Phaser.Scene {
  selected: number = 1
  players: PlayerState[] = this.registry.get('players') || []
  characterButtons: Phaser.GameObjects.Image[] = []
  characterOutline: Phaser.GameObjects.Arc | null = null

  constructor() {
    super('StreamChampSelect')
  }

  preload() {
    this.add.image(0, 0, 'background').setOrigin(0, 0)
  }

  create() {
    characterNames.forEach((name, index) => {
      const button = this.add.image(100 + index * 100, 100, name).setOrigin(0.5, 0.5)
      this.characterButtons.push(button)
    })
    this.players.forEach((player) => {
      const selectedByPlayerIndicator = this.add.circle(200, 200, 100, 0xff0000)
    })
  }

  update() {
    this.characterOutline?.setPosition(
      200 * (1 + this.selected - 5 * Math.floor(this.selected / 5)),
      200 * (1 + Math.floor(this.selected / 5))
    )
  }
}
