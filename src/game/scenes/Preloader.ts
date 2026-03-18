import { Scene } from 'phaser'
import { characterNames } from '../constants'
import { getState, isHost, myPlayer, PlayerState, setState } from 'playroomkit'

export class Preloader extends Scene {
  selected: number = 1
  pickedChamps: string[] = []
  characterButtons: Phaser.GameObjects.Image[] = []
  characterOutline: Phaser.GameObjects.Arc | null = null
  playerNames: Phaser.GameObjects.Text[] = []
  constructor() {
    super('Preloader')
  }
  init() {
    this.add.image(0, -50, 'background').setOrigin(0, 0).setScale(1.25)
    this.characterOutline = this.add.circle(200, 200, 100, myPlayer().getProfile().color.hex)
  }
  create() {
    const nextButton = this.add.rectangle(950, 800, 100, 50, 0).setInteractive()
    characterNames.forEach((name, i) => {
      const button = this.add
        .image(
          350 + 200 * (1 + i - 5 * Math.floor(i / 5)),
          200 + 200 * (1 + Math.floor(i / 5)),
          name
        )
        .setScale(0.25)
        .setInteractive()
      button.on('pointerup', () => {
        if (
          !myPlayer().getState('ready') &&
          !getState('picked').find((pickedname: string) => pickedname == name)
        ) {
          this.selected = i
        }
      })
      button.setDepth(10)
      this.characterButtons.push(button)
    })

    nextButton.on('pointerup', () => {
      myPlayer().setState('character', characterNames[this.selected])
      myPlayer().setState('ready', true)
      setState('picked', [...getState('picked'), characterNames[this.selected]])
      nextButton.setFillStyle(0x00ff00)
    })
  }

  update() {
    const players: PlayerState[] = this.registry.get('players') || []
    players.forEach((player, index) => {
      if (!this.playerNames.find((name) => name.text == player.getProfile().name)) {
        const nameText = this.add.text(300, 20 * index, player.getProfile().name)
        this.playerNames = [...this.playerNames, nameText]
      }
    })

    this.characterOutline?.setPosition(
      350 + 200 * (1 + this.selected - 5 * Math.floor(this.selected / 5)),
      200 + 200 * (1 + Math.floor(this.selected / 5))
    )

    const picked: string[] = getState('picked')
    if (picked) {
      picked.forEach((champ) => {
        if (!this.pickedChamps.find((pickedChamp) => pickedChamp == champ)) {
          const index = characterNames.findIndex((name) => name == champ)
          this.add
            .circle(
              200 * (1 + index - 5 * Math.floor(index / 5)),
              200 * (1 + Math.floor(index / 5)),
              100,
              0xff0000
            )
            .setDepth(1)
        }
      })
    }

    if (isHost()) {
      if (players.filter((player) => player.getState('ready') == true).length == players.length) {
        this.registry.set(
          'alivePlayers',
          players.map((p) => p.id)
        )
        setState('gameWon', false)

        setState('gameActive', true)
        setState('picked', [])
      }
    }
    if (getState('gameActive')) {
      this.scene.start('MainMenu')
    }
  }
}
