import { Scene } from 'phaser'
import { characterNames } from '../constants'
import { getState, isHost, myPlayer, PlayerState, setState } from 'playroomkit'

export class Preloader extends Scene {
  selected: number = 1
  pickedChamps: string[] = []
  characterButtons: Phaser.GameObjects.Image[] = []
  characterOutline: Phaser.GameObjects.Arc | null = null
  playerNames: Phaser.GameObjects.Text[] = []
  spectatorNames: Phaser.GameObjects.Text[] = []
  specButton: Phaser.GameObjects.Container | null = null
  readyButton: Phaser.GameObjects.Image | null = null

  constructor() {
    super('Preloader')
  }
  getButtonX(index: number) {
    if (!this.registry.get('isDesktop')) {
      return 900 + 200 * (1 + index - 3 * Math.floor(index / 3))
    }
    return 350 + 200 * (1 + index - 5 * Math.floor(index / 5))
  }
  getButtonY(index: number) {
    if (!this.registry.get('isDesktop')) {
      return 50 + 200 * (1 + Math.floor(index / 3))
    }
    return 200 + 200 * (1 + Math.floor(index / 5))
  }

  init() {
    this.playerNames = []
    this.spectatorNames = []
    if (this.registry.get('isDesktop')) {
      this.add.image(0, -50, 'background').setOrigin(0, 0).setScale(1.25)
      this.add.image(0, 0, 'pickBackground').setOrigin(0, 0)
    } else {
      this.add.rectangle(0, 0, 1920, 1080, 0xd3d3d3).setOrigin(0, 0)
      this.add.image(400, -50, 'background').setOrigin(0, 0).setScale(1.25)
      this.add.image(640, 0, 'pickBackground').setOrigin(0, 0).setScale(0.7, 1)
    }
    this.characterOutline = this.add.circle(
      200,
      200,
      100,
      myPlayer()?.getState('profile')?.color?.hex || 0x9f2b68
    )
  }
  create() {
    characterNames.forEach((name, i) => {
      const button = this.add
        .image(this.getButtonX(i), this.getButtonY(i), name)
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
    if (this.registry.get('isDesktop')) {
      this.add.image(950, 950, 'lockInButtonInactive')
      this.readyButton = this.add.image(950, 950, 'lockInButtonActive').setInteractive()
    } else {
      this.add.image(1300, 1000, 'lockInButtonInactive')
      this.readyButton = this.add.image(1300, 1000, 'lockInButtonActive').setInteractive()
    }

    this.readyButton.on('pointerup', () => {
      myPlayer().setState('character', characterNames[this.selected])
      myPlayer().setState('ready', true)
      setState('picked', [...getState('picked'), characterNames[this.selected]])
      this.readyButton?.setVisible(false)
    })
    if (myPlayer().getState('spectator')) {
      this.readyButton?.setVisible(false)
      this.characterOutline?.setVisible(false)
    }
    this.specButton = this.add.container(600, 20)
    this.specButton.add(
      this.add
        .rectangle(0, 0, 160, 30, 0)
        .setInteractive()
        .on('pointerup', () => {
          if (!myPlayer().getState('spectator')) {
            myPlayer().setState('spectator', true)
            this.readyButton?.setVisible(false)
            this.characterOutline?.setVisible(false)
          } else {
            myPlayer().setState('spectator', false)
            this.readyButton?.setVisible(true)
            this.characterOutline?.setVisible(true)
          }
        })
    )
    this.specButton.add(
      this.add
        .text(-70, -6, `${myPlayer().getState('spectator') ? 'leave' : 'join'} specators`)
        .setName('specButtonText')
    )

    this.add.text(10, 0, 'Players: ')
    this.add.text(200, 0, 'Spectators: ')
  }

  update() {
    const players: PlayerState[] = this.registry.get('players') || []

    if (this.registry.get('isDesktop')) {
      if (this.playerNames.length > players.length) {
        this.playerNames.forEach((name) => name.destroy())
        this.playerNames = []
      }
      let offset = 0

      players.forEach((player, index) => {
        const isSpectator = player.getState('spectator')
        const playerName = player?.getProfile()?.name
        const playerText = this.playerNames.find((name) => name.text == playerName)
        if (isSpectator) {
          this.registry.set('spectators', [...this.registry.get('spectators'), player])
          this.registry.set(
            'players',
            this.registry
              .get('players')
              .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
          )
          this.playerNames.forEach((name) => name.destroy())
          this.playerNames = []
          offset += 1
        } else if (!playerText) {
          {
            this.specButton
              ?.getByName<Phaser.GameObjects.Text>('specButtonText')
              .setText(`${myPlayer().getState('spectator') ? 'leave' : 'join'} specators`)
            const nameText = this.add.text(100, 20 * (index - offset), playerName)
            this.playerNames = [...this.playerNames, nameText]
          }
        }
      })
      offset = 0
      const spectators: PlayerState[] = this.registry.get('spectators') || []
      if (this.spectatorNames.length > spectators.length) {
        this.spectatorNames.forEach((name) => name.destroy())
        this.spectatorNames = []
      }
      spectators.forEach((player, index) => {
        const isSpectator = player.getState('spectator')
        const playerName = player?.getProfile()?.name
        const spectatorText = this.spectatorNames.find((name) => name.text == playerName)
        if (!isSpectator) {
          this.registry.set('players', [...this.registry.get('players'), player])
          this.registry.set(
            'spectators',
            this.registry
              .get('spectators')
              .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
          )
          this.spectatorNames.forEach((name) => name.destroy())
          this.spectatorNames = []
          offset += 1
        } else if (!spectatorText) {
          {
            this.specButton
              ?.getByName<Phaser.GameObjects.Text>('specButtonText')
              .setText(`${myPlayer().getState('spectator') ? 'leave' : 'join'} specators`)
            const nameText = this.add.text(320, 20 * (index - offset), playerName)
            this.spectatorNames = [...this.spectatorNames, nameText]
          }
        }
      })
    }

    this.characterOutline?.setPosition(
      this.getButtonX(this.selected),
      this.getButtonY(this.selected)
    )

    const picked: string[] = getState('picked')
    if (picked.length >= characterNames.length && !myPlayer().getState('ready')) {
      myPlayer().setState('spectator', true)
      this.readyButton?.setVisible(false)
      this.characterOutline?.setVisible(false)
    } else if (picked) {
      picked.forEach((champ) => {
        if (!this.pickedChamps.includes(champ)) {
          const index = characterNames.findIndex((name) => name == champ)
          if (this.selected == index && !myPlayer().getState('ready')) {
            while (picked.includes(characterNames[this.selected])) {
              this.selected = this.selected >= 1 ? this.selected - 1 : 9
            }
          }
          this.add
            .circle(
              this.getButtonX(index),
              this.getButtonY(index),
              100,
              this.selected == index ? 0x008000 : 0xff0000
            )
            .setDepth(1)
        }
      })
    }

    if (isHost()) {
      if (
        players.filter((player) => player.getState('ready') == true).length == players.length &&
        players.length > 0
      ) {
        setState(
          'alivePlayers',
          players.map((p) => p.id)
        )
        this.registry.set(
          'alivePlayers',
          players.map((p) => p.id)
        )
        setState('gameWon', false)
        setState('gameActive', true)
        setState('picked', [])
        setState('projectiles', [])
      }
    }
    if (getState('gameActive')) {
      this.scene.start('MainMenu')
    }
  }
}
