import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import {
  getState,
  isHost,
  myPlayer,
  onPlayerJoin,
  PlayerState,
  resetPlayersStates,
  resetStates,
  setState,
} from 'playroomkit'
import nipplejs from 'nipplejs'

const radToXY = (rad: number) => {
  return {
    x: Math.cos(rad),
    y: Math.sin(rad),
  }
}

export class MainMenu extends Scene {
  joystick: nipplejs.JoystickManager | undefined = undefined
  playerStates: PlayerState[] = []
  players: {
    sprite: Phaser.GameObjects.Image
    state: PlayerState
  }[] = []

  constructor() {
    super('MainMenu')
  }
  init() {
    this.joystick = nipplejs.create({})
    this.players = []
  }

  create() {
    this.playerStates = this.registry.get('players')

    this.joystick.on('move', (_, data) => {
      const angle = radToXY(data.angle.radian)
      myPlayer().setState('joystick', { ...angle, force: data.force })
    })
    this.joystick.on('end', () => {
      myPlayer().setState('joystick', { x: 0, y: 0, force: 0 })
    })

    if (!this.scene.systems.game.device.os.desktop) {
      this.add.rectangle(640, 460, 1280, 720, 0xd3d3d3)
    } else {
      this.add.image(640, 500, 'background').setScale(0.8)
    }

    this.playerStates.forEach((playerState, index) => {
      let character: string = playerState.getState('character')
      const sprite = this.add.image(640, 360, character).setScale(0.1)
      this.physics.add.existing(sprite, false)

      const body = sprite.body as Phaser.Physics.Arcade.Body
      body.setCollideWorldBounds(true)
      this.physics.add.collider(
        sprite,
        this.players.map((a) => a.sprite)
      )

      this.add.text(100, 20 * index, playerState.getProfile().name)

      this.players.push({
        sprite,
        state: playerState,
      })
      playerState.onQuit(() => {
        sprite.destroy()
        this.players = this.players.filter((p) => p.state !== playerState)
      })
    })

    EventBus.emit('current-scene-ready', this)
  }

  update(time: number) {
    if (isHost()) {
      const alivePlayers: string[] = this.registry.get('alivePlayers')
      if (time % 4 == 0) {
        let vector = new Phaser.Math.Vector2()
        Phaser.Math.RandomXY(vector)
        let x, y
        if (vector.x > vector.y) {
          x = 0
          y = Math.abs(vector.y) * 720
        } else {
          x = Math.abs(vector.x) * 1280
          y = 0
        }

        const rect = this.add.rectangle(x, y, 50, 50, 0)
        this.physics.add.existing(rect, false)
        rect.body.setVelocity(vector.x * 100, vector.y * 100)

        this.players.forEach((player) => {
          this.physics.add.overlap(rect, player.sprite, (_, playerSprite) => {
            playerSprite.destroy()
            player.state.setState('active', false)
            if (player.state.id == myPlayer().id) {
              this.add.text(500, 500, 'you died')
            }
            this.registry.set(
              'alivePlayers',
              this.registry
                .get('alivePlayers')
                .filter((alivePlayerID: string) => alivePlayerID != player.state.id)
            )
            setState('alivePlayers', this.registry.get('alivePlayers'))
            console.log(this.registry.get('alivePlayers'))
          })
        })
      }

      for (const player of this.players) {
        if (player.sprite.active) {
          const body = player.sprite.body as Phaser.Physics.Arcade.Body

          const joystick = player.state.getState('joystick') || { x: 0, y: 0, force: 0 }
          body.setVelocity(200 * joystick.x * joystick.force, -200 * joystick.y * joystick.force)

          player.state.setState('pos', {
            x: body.x,
            y: body.y,
          })
        }
        if (alivePlayers.length == 1) {
          setState('gameWon', true)
          setState('winner', alivePlayers[0])
        }
      }
    } else {
      for (const player of this.players) {
        if (player.state.getState('active') == false) {
          player.sprite.destroy(true)
          if (player.state.id == myPlayer().id) {
            this.joystick?.destroy()
            this.add.text(500, 500, 'you died')
          }
        }

        const pos = player.state.getState('pos')
        const body = player.sprite.body as Phaser.Physics.Arcade.Body

        if (pos && body) {
          body.x = pos.x
          body.y = pos.y
        }
      }
    }

    if (getState('gameWon')) {
      this.add.text(
        400,
        400,
        this.playerStates.find((player) => player.id == getState('winner'))?.getProfile().name +
          ' won'
      )
      this.time.delayedCall(5000, () => {
        if (isHost()) {
          resetPlayersStates()
          resetStates()
        }
        this.joystick?.destroy()
        this.scene.stop('MainMenu')
        this.scene.start('Preloader')
      })
    }
  }
}
