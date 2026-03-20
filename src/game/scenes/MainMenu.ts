import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import {
  getState,
  isHost,
  myPlayer,
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
    sprite: Phaser.Physics.Matter.Image | Phaser.GameObjects.Image
    state: PlayerState
  }[] = []
  hitboxes: Phaser.GameObjects.Rectangle[] = []
  hitboxCords = [
    { x: 660, y: 425, sx: 30, sy: 150, rot: 0.5 },
    { x: 1143, y: 354, sx: 30, sy: 170, rot: -1 },
    { x: 1238, y: 675, sx: 25, sy: 195, rot: 0.5 },
    { x: 1168, y: 740, sx: 40, sy: 40, rot: -0.5 },
    { x: 675, y: 710, sx: 30, sy: 160, rot: -0.6 },
    { x: 845, y: 455, sx: 30, sy: 80, rot: 0.7 },
    { x: 1040, y: 450, sx: 30, sy: 80, rot: -0.9 },
    { x: 1040, y: 635, sx: 30, sy: 80, rot: 0.8 },
    { x: 845, y: 635, sx: 30, sy: 80, rot: -0.8 },
  ]
  playerCollisionGroup: number = 0
  projectileCollissionGroup: number = 0
  constructor() {
    super('MainMenu')
  }

  init() {
    this.joystick = nipplejs.create({})
    this.players = []
    this.playerCollisionGroup = this.matter.world.nextCategory()
    this.projectileCollissionGroup = this.matter.world.nextCategory()
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
      this.hitboxes = this.hitboxCords.map((cords) => {
        const rect = this.add
          .rectangle(cords.x, cords.y, cords.sx, cords.sy, 0xff0000)
          .setRotation(cords.rot)
          .setOrigin(0, 0)
          .setScale(1.25)
        this.matter.add.gameObject(rect, {
          isStatic: true,
          angle: cords.rot,
        })

        return rect
      })
      this.add.image(0, -50, 'background').setOrigin(0, 0).setScale(1.25)
    }

    this.playerStates.forEach((playerState, index) => {
      const character: string = playerState.getState('character')

      const sprite = this.matter.add
        .image(960, 540, character)
        .setScale(0.08)
        .setBounce(0)
        .setFixedRotation()
        .setCollisionCategory(this.playerCollisionGroup)
        .setName(playerState.id)

      sprite.setInteractive({
        pixelPerfect: true,
        alphaTolerance: 1,
      })

      this.add.text(100, 20 * index, playerState.getProfile().name)

      this.players.push({ sprite, state: playerState })

      playerState.onQuit(() => {
        sprite.destroy()
        this.players = this.players.filter((p) => p.state !== playerState)
      })
    })

    EventBus.emit('current-scene-ready', this)
  }

  update(time: number) {
    if (isHost()) {
      const alivePlayers: string[] = getState('alivePlayers')

      if (time % 4 == 0) {
        let vector = new Phaser.Math.Vector2()
        Phaser.Math.RandomXY(vector)
        let x, y

        if (vector.x > vector.y) {
          x = 0
          y = Math.abs(vector.y) * 1080
        } else {
          x = Math.abs(vector.x) * 1920
          y = 0
        }

        const rect = this.matter.add
          .image(x, y, 'ezrealQ')
          .setRotation(vector.angle())
          .setScale(0.5)
          .setVelocity(vector.x * 3, vector.y * 3)
          .setFixedRotation()
          .setFriction(0)
          .setFrictionAir(0)
          .setCollisionCategory(this.projectileCollissionGroup)
          .setCollidesWith([this.playerCollisionGroup])
          .setSensor(true)
          .setOnCollide((event) => {
            const playerBody = event.bodyA.gameObject
            const player = this.players.find((p) => p.sprite.name === playerBody.name)

            if (!player) return

            playerBody.destroy()
            player.state.setState('active', false)

            if (player.state.id == myPlayer().id) {
              this.add.text(750, 540, 'you died')
            }

            setState(
              'alivePlayers',
              getState('alivePlayers').filter(
                (alivePlayerID: string) => alivePlayerID != player.state.id
              )
            )
          })
      }

      for (const player of this.players) {
        if (player.sprite.active) {
          const joystick = player.state.getState('joystick') || { x: 0, y: 0, force: 0 }

          player.sprite.setVelocity(
            2 * joystick.x * joystick.force,
            -2 * joystick.y * joystick.force
          )

          player.state.setState('pos', {
            x: player.sprite.x,
            y: player.sprite.y,
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

        if (pos && player.sprite.body) {
          player.sprite.setPosition(pos.x, pos.y)
        }
      }
    }

    if (getState('gameWon')) {
      this.add.text(
        400,
        400,
        this.playerStates.find((p) => p.id == getState('winner'))?.getProfile().name + ' won'
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
