import { Scene } from 'phaser'
import {
  bigAccumulator,
  bigCooldown,
  characterNames,
  difficulties,
  smallAccumulator,
  smallCooldown,
} from '../constants'
import { getRoomCode, getState, isHost, myPlayer, PlayerState, RPC, setState } from 'playroomkit'
import { resetRPCs, setPreloaderRef } from '../rpc'

export class Preloader extends Scene {
  selected: number = 1
  pickedChamps: string[] = []
  characterButtons: Phaser.GameObjects.Image[] = []
  characterOutline: Phaser.GameObjects.Image | null = null
  playerNames: Phaser.GameObjects.Text[] = []
  spectatorNames: Phaser.GameObjects.Text[] = []
  specButton: Phaser.GameObjects.Container | null = null
  readyButton: Phaser.GameObjects.Image | null = null
  qrCode: Phaser.GameObjects.Image | null = null
  difficulty: number = 0
  rpcInit = false

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

  moveSelectedBorder() {
    this.characterOutline?.setPosition(
      this.getButtonX(this.selected),
      this.getButtonY(this.selected)
    )
  }
  checkStart() {
    if (
      isHost() &&
      this.registry.get('players').length > 0 &&
      this.registry.get('players').every((p: PlayerState) => p.getState('ready'))
    ) {
      RPC.call('startGame', '', RPC.Mode.ALL)
    }
  }
  reDrawNames() {
    if (
      this.playerNames.length != this.registry.get('players').length ||
      this.spectatorNames.length != this.registry.get('spectators').length
    ) {
      this.checkStart()
      this.playerNames?.forEach((n) => n.destroy())
      this.playerNames = []
      this.spectatorNames?.forEach((n) => n.destroy())
      this.spectatorNames = []

      this.registry.get('spectators')?.forEach((spectator: PlayerState, i: number) => {
        const nameText = this.add.text(10, 525 + 20 * i, spectator.getState('name'), {
          fontFamily: 'goldman',
          fontSize: 18,
        })
        this.spectatorNames.push(nameText)
      })

      this.registry
        .get('players')
        ?.sort((a: PlayerState, b: PlayerState) => a.getState('points') < b.getState('points'))
        .forEach((player: PlayerState, i: number) => {
          const nameText = this.add
            .text(10, 25 + 20 * i, `${player.getState('name')} - ${player.getState('points')}`, {
              fontFamily: 'goldman',
              fontSize: 18,
            })
            .setDepth(5)
          this.playerNames.push(nameText)
        })
    }
  }

  // called from rpc.ts
  drawChamp(data: string) {
    const index = characterNames.findIndex((name) => name == data)
    const button = this.characterButtons[index]
    if (this.pickedChamps.includes(data) && !getState('picked').includes(data)) {
      this.pickedChamps.filter((a) => a != data)
      button.clearTint()
    } else {
      this.pickedChamps.push(data)
      if (this.pickedChamps.length >= characterNames.length) {
        if (!myPlayer().getState('ready')) {
          myPlayer().setState('spectator', true)
          RPC.call('moveToSpectator', myPlayer().id, RPC.Mode.ALL)
        }
      } else if (this.selected == index && !myPlayer().getState('ready')) {
        while (this.pickedChamps.includes(characterNames[this.selected])) {
          this.selected = this.selected >= 1 ? this.selected - 1 : characterNames.length - 1
          this.moveSelectedBorder()
        }
      }
      button.setTint(index == this.selected ? 0x17a319 : 0x730000)
    }
    this.checkStart()
  }

  // called from rpc.ts
  startGame() {
    const players: PlayerState[] = this.registry.get('players') || []
    if (isHost()) {
      this.registry.get('spectators').forEach((s: PlayerState) => s.setState('points', 0))
      setState(
        'alivePlayers',
        players.map((p) => p.id)
      )
      this.registry.set(
        'alivePlayers',
        players.map((p) => p.id)
      )
      setState('gameWon', false)
      setState('picked', [])
      setState('points', 0)
      setState('projectiles', [])
      setState('gameActive', true)
      setState('smallAccumulator', smallAccumulator)
      setState('bigAccumulator', bigAccumulator)
      setState('smallSpell', smallCooldown[this.difficulty])
      setState('bigSpell', bigCooldown[this.difficulty])
    }
    this.sound.stopAll()
    this.scene.start('MainMenu')
  }

  init() {
    setPreloaderRef(this)
    if (getState('gameActive')) {
      this.scene.start('MainMenu')
    }
    this.characterButtons = []
    this.playerNames = []
    this.spectatorNames = []
    this.pickedChamps = []
    if (this.registry.get('isDesktop')) {
      this.add.image(0, -50, 'background').setOrigin(0, 0).setScale(1.25)
      this.add.image(0, 0, 'pickBackground').setOrigin(0, 0)
    } else {
      this.add.image(400, -50, 'background').setOrigin(0, 0).setScale(1.25)
      this.add.image(640, 0, 'pickBackground').setOrigin(0, 0).setScale(0.7, 1)
      this.add.rectangle(0, 1070, 1920, window.innerHeight, 0).setOrigin(0, 0)
    }
    this.characterOutline = this.add
      .image(this.getButtonX(this.selected), this.getButtonY(this.selected), 'pickBorder')
      .setScale(0.8)
      .setDepth(12)
    const { x, y } = this.registry.get('isDesktop') ? { x: 960, y: 500 } : { x: 1300, y: 500 }

    this.qrCode = this.add.image(x, y, 'qr').setVisible(false).setDepth(20).setScale(4)
    this.reDrawNames()
  }
  create() {
    characterNames.forEach((name, i) => {
      const spectating = myPlayer().getState('spectator')
      const button = this.add
        .image(this.getButtonX(i), this.getButtonY(i), name)
        .setScale(0.25)
        .setInteractive()
      if (spectating) {
        button.disableInteractive()
      } else if (i == this.selected) {
        button.setTint(0x999999)
      }
      button.on('pointerup', () => {
        if (
          !myPlayer()?.getState('ready') &&
          !getState('picked').find((pickedname: string) => pickedname == name)
        ) {
          this.characterButtons[this.selected].clearTint()
          button.setTint(0x999999)
          this.selected = i
        }
        this.moveSelectedBorder()
      })
      button.setDepth(10)
      this.characterButtons.push(button)
    })
    if (this.registry.get('isDesktop')) {
      this.sound.play('champSelect', {
        loop: true,
        volume: 0.3,
      })
      this.add.image(950, 950, 'lockInButtonInactive')
      if (!myPlayer().getState('ready')) {
        this.readyButton = this.add.image(950, 950, 'lockInButtonActive').setInteractive()
      }
    } else {
      this.add.image(1300, 1000, 'lockInButtonInactive')
      if (!myPlayer().getState('ready')) {
        this.readyButton = this.add.image(1300, 1000, 'lockInButtonActive').setInteractive()
      }
    }

    this.add.text(1700, 10, 'Room code: ' + getRoomCode(), {
      fontFamily: 'goldman',
      fontSize: 20,
    })

    this.add.container(1700, 40).add([
      this.add
        .rectangle(0, 0, 170, 30, 0)
        .setOrigin(0, 0)
        .setInteractive()
        .on('pointerup', () => {
          setState(myPlayer()?.id, undefined)
          myPlayer()?.leaveRoom()
          resetRPCs()
          this.events.destroy()
          this.game.destroy(true)
        }),
      this.add.text(30, 5, 'leave room', {
        fontFamily: 'goldman',
        fontSize: 20,
      }),
    ])

    const qrButton = this.add.container(1700, 80).add([
      this.add
        .rectangle(0, 0, 170, 30, 0)
        .setOrigin(0, 0)
        .setInteractive()
        .on('pointerup', () => {
          this.qrCode?.setVisible(!this.qrCode.visible)
          qrButton
            .getByName<Phaser.GameObjects.Text>('buttonText')
            .setText(this.qrCode?.visible ? 'hide room qr' : 'show room qr')
        }),
      this.add
        .text(85, 15, 'show room qr', {
          fontFamily: 'goldman',
          fontSize: 20,
        })
        .setName('buttonText')
        .setOrigin(0.5, 0.5),
    ])

    this.readyButton?.on('pointerup', () => {
      const character = characterNames[this.selected]
      myPlayer()?.setState('character', character)
      myPlayer()?.setState('ready', true)
      setState('picked', [...getState('picked'), character])
      this.readyButton?.setVisible(false)
      this.specButton?.setVisible(false)
      RPC.call('pickedChamp', character, RPC.Mode.ALL)
    })
    if (myPlayer()?.getState('spectator')) {
      this.readyButton?.setVisible(false)
      this.characterOutline?.setVisible(false)
    }

    const specButtonLocation = this.registry.get('isDesktop') ? [90, 470] : [900, 30]
    this.specButton = this.add.container(...specButtonLocation)
    this.specButton.add(
      this.add
        .rectangle(0, 0, 160, 30, 0)
        .setInteractive()
        .on('pointerup', () => {
          if (!myPlayer()?.getState('spectator')) {
            myPlayer()?.setState('spectator', true)
            this.readyButton?.setVisible(false)
            this.characterOutline?.setVisible(false)
            this.characterButtons[this.selected].clearTint()
            this.characterButtons.forEach((button) => button.disableInteractive())
            RPC.call('moveToSpectator', myPlayer().id)
          } else {
            myPlayer()?.setState('spectator', false)
            this.readyButton?.setVisible(true)
            this.characterOutline?.setVisible(true)
            this.characterButtons[this.selected].setTint(0x999999)
            this.characterButtons.forEach((button) => button.setInteractive())
            RPC.call('moveToPlayer', myPlayer().id)
          }
          this.specButton
            ?.getByName<Phaser.GameObjects.Text>('specButtonText')
            .setText(`${myPlayer()?.getState('spectator') ? 'leave' : 'join'} specators`)
        })
    )
    this.specButton.add(
      this.add
        .text(0, 0, `${myPlayer()?.getState('spectator') ? 'leave' : 'join'} specators`, {
          fontFamily: 'goldman',
          fontSize: 18,
        })
        .setName('specButtonText')
        .setOrigin(0.5, 0.5)
    )

    this.add.text(10, 0, 'Players: ', {
      fontFamily: 'goldman',
      fontSize: 20,
    })
    this.add.text(10, 500, 'Spectators: ', {
      fontFamily: 'goldman',
      fontSize: 20,
    })

    if (isHost()) {
      const difficultyButton = this.add.container(1700, 130)
      difficultyButton.add([
        this.add
          .text(85, 0, 'Difficulty', {
            fontFamily: 'goldman',
            fontSize: 18,
          })
          .setOrigin(0.5, 0.5),
        this.add
          .rectangle(85, 30, 170, 30, 0)
          .setInteractive()
          .on('pointerup', () => {
            this.difficulty = (this.difficulty + 1) % 3
            difficultyButton
              .getByName<Phaser.GameObjects.Text>('btext')
              .setText(difficulties[this.difficulty])
          }),
        this.add
          .text(85, 30, difficulties[this.difficulty], {
            fontFamily: 'goldman',
            fontSize: 18,
          })
          .setOrigin(0.5, 0.5)
          .setName('btext'),
      ])
    }
    const pickedState = getState('picked')
    pickedState.forEach((name: string) => {
      this.drawChamp(name)
    })
  }

  update() {
    this.reDrawNames()
  }
}
