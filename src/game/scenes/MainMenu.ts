import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { isHost, myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'
import nipplejs from 'nipplejs'
import { characterNames } from '../constants'

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
  alivePlayers: string[] = []

  constructor() {
    super('MainMenu')
  }
  create() {
    const joystick = nipplejs.create({})

    joystick.on('move', (_, data) => {
      const angle = radToXY(data.angle.radian)
      myPlayer().setState('joystick', { ...angle, force: data.force })
    })
    joystick.on('end', () => {
      myPlayer().setState('joystick', { x: 0, y: 0, force: 0 })
    })

    onPlayerJoin((playerState) => {
      this.addPlayer(playerState, joystick)
      console.log(this.players)
    })

    if (!this.scene.systems.game.device.os.desktop) {
      this.add.rectangle(640, 460, 1280, 720, 0xd3d3d3)
    } else {
      this.add.image(640, 500, 'background').setScale(0.8)
    }
    EventBus.emit('current-scene-ready', this)
  }

  addPlayer(playerState: PlayerState, joystick: nipplejs.JoystickManager) {
    let character: string = playerState.getState('character')
    const sprite = this.add.image(640, 360, character).setScale(0.1)
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
    this.alivePlayers.push(playerState.id)
  }

  update(time: number) {
    if (isHost()) {
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

        this.physics.add.overlap(
          rect,
          this.players.map((playerState) => playerState.sprite),
          (_, player) => {
            player.destroy(true)
          }
        )
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
        } else {
          player.state.setState('active', false)
          this.alivePlayers = this.alivePlayers.filter(
            (alivePlayerID) => alivePlayerID != player.state.id
          )
        }
      }

      if (this.alivePlayers.length == 1) {
        this.add.text(400, 400, this.alivePlayers[0] + ' won')
      }
    } else {
      for (const player of this.players) {
        if (player.state.getState('active') == false) {
          player.sprite.destroy(true)
        }

        const pos = player.state.getState('pos')
        const body = player.sprite.body as Phaser.Physics.Arcade.Body

        if (pos && body) {
          body.x = pos.x
          body.y = pos.y
        }
      }
    }
  }
}
