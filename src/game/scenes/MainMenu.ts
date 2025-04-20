import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { isHost, Joystick, myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'

const radToXY = (rad: number) => {
  return {
    x: Math.sin(rad),
    y: Math.cos(rad),
  }
}

export class MainMenu extends Scene {
  controls = {}
  players: { sprite: Phaser.GameObjects.Rectangle; state: PlayerState; joystick: Joystick }[] = []

  constructor() {
    super('MainMenu')
  }
  create() {
    onPlayerJoin((playerState) => {
      const joystick = new Joystick(playerState, {
        type: 'angular',
        buttons: [
          {
            id: 'jump',
            label: 'jump',
          },
        ],
      })
      this.addPlayer(playerState, joystick)
    })
    this.add.image(640, 500, 'background')
    EventBus.emit('current-scene-ready', this)
  }

  addPlayer(playerState: PlayerState, joystick: Joystick) {
    const sprite = this.add.rectangle(
      this.players.length,
      0,
      20,
      20,
      playerState.getProfile().color.hex
    )
    this.physics.add.existing(sprite, false)
    const body = sprite.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    this.physics.add.collider(
      sprite,
      this.players.map((a) => a.sprite)
    )

    this.players.push({
      sprite,
      state: playerState,
      joystick: joystick,
    })
    playerState.onQuit(() => {
      sprite.destroy()
      this.players = this.players.filter((p) => p.state !== playerState)
    })
  }
  update() {
    if (isHost()) {
      for (const player of this.players) {
        const controls = player.joystick
        const body = player.sprite.body as Phaser.Physics.Arcade.Body
        const { y, x } = radToXY(controls.angle())

        if (controls.isJoystickPressed()) {
          body.setVelocityX(Math.round(160 * x))
        } else {
          body.setVelocityX(0)
        }

        if (controls.isJoystickPressed()) {
          body.setVelocityY(Math.round(160 * y))
        } else {
          body.setVelocityY(0)
        }

        player.state.setState('pos', {
          x: body.x,
          y: body.y,
        })
      }
    } else {
      for (const player of this.players) {
        const pos = player.state.getState('pos')
        const body = player.sprite.body as Phaser.Physics.Arcade.Body

        if (pos) {
          body.x = pos.x
          body.y = pos.y
        }
      }
    }
  }
}
