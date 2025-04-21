import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { isHost, Joystick, myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'
import nipplejs, { JoystickManager } from 'nipplejs'

const radToXY = (rad: number) => {
  return {
    x: Math.cos(rad),
    y: Math.sin(rad),
  }
}

export class MainMenu extends Scene {
  controls = {}
  players: {
    sprite: Phaser.GameObjects.Image
    state: PlayerState
    joystick: nipplejs.JoystickManager
  }[] = []

  constructor() {
    super('MainMenu')
  }
  create() {
    onPlayerJoin((playerState) => {
      this.addPlayer(playerState, joystick)
    })
    const joystick = nipplejs.create({})

    joystick.on('move', (_, data) => {
      const angle = radToXY(data.angle.radian)

      myPlayer().setState('joystick', { ...angle, force: data.force })
    })
    joystick.on('end', () => {
      myPlayer().setState('joystick', { x: 0, y: 0, force: 0 })
    })

    this.add.image(640, 500, 'background').setScale(0.8)
    EventBus.emit('current-scene-ready', this)
  }

  addPlayer(playerState: PlayerState, joystick: nipplejs.JoystickManager) {
    const sprite = this.add.image(640, 360, 'player').setScale(0.1)
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
        const body = player.sprite.body as Phaser.Physics.Arcade.Body

        const joystick = player.state.getState('joystick') || { x: 0, y: 0, force: 0 }
        body.setVelocity(200 * joystick.x * joystick.force, -200 * joystick.y * joystick.force)

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
