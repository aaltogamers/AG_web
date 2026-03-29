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
    sprite: Phaser.Physics.Matter.Image
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
  outerEdgeHitBoxPoints: Phaser.Geom.Point[] = []
  playerCollisionGroup: number = 2
  projectileCollissionGroup: number = 4
  projectiles: { gameObject: Phaser.Physics.Matter.Image; type: string }[] = []
  edgeCircle: Phaser.Geom.Circle | undefined = undefined
  constructor() {
    super('MainMenu')
  }

  init() {
    this.joystick = nipplejs.create({})
    this.players = []
    this.projectiles = []
  }

  create() {
    this.playerStates = this.registry.get('players')

    this.joystick?.on('move', (_, data) => {
      const angle = radToXY(data.angle.radian)
      myPlayer().setState('joystick', { ...angle, force: data.force })
    })
    this.joystick?.on('end', () => {
      myPlayer().setState('joystick', { x: 0, y: 0, force: 0 })
    })

    if (isHost() && getState('ezSpawnTime') == 4) {
      this.time.delayedCall(10000, () => {
        setState('ezSpawnTime', 3)
      })
      this.time.delayedCall(20000, () => {
        setState('ezSpawnTime', 2)
        setState('ezUltSpawnTime', 6)
      })
      this.time.delayedCall(40000, () => {
        setState('ezSpawnTime', 1)
        setState('ezUltSpawnTime', 3)
      })
    }

    if (!this.scene.systems.game.device.os.desktop) {
      this.add.rectangle(0, 0, 1920, 1080, 0x2b2b2b).setOrigin(0, 0)
      this.add.image(1300, 500, 'touchIcon').setScale(0.5)
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

      this.edgeCircle = new Phaser.Geom.Circle(930, 580, 500)
      this.edgeCircle.getPoints(128, undefined, this.outerEdgeHitBoxPoints)
      let lastPoint = this.outerEdgeHitBoxPoints[this.outerEdgeHitBoxPoints.length - 1]
      this.outerEdgeHitBoxPoints.forEach((point) => {
        const rot = Phaser.Math.Angle.Between(point.x, point.y, lastPoint.x, lastPoint.y)
        const magnitude = Phaser.Math.Distance.Between(point.x, point.y, lastPoint.x, lastPoint.y)
        const hitbox = this.add.rectangle(point.x, point.y, magnitude + 5, 60, 0).setRotation(rot)
        this.matter.add.gameObject(hitbox, {
          isStatic: true,
          angle: rot,
        })
        this.hitboxes = [...this.hitboxes, hitbox]
        lastPoint = point
      })
      this.add.image(0, -50, 'background').setOrigin(0, 0).setScale(1.25)

      this.playerStates.forEach((playerState) => {
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

        this.players.push({ sprite, state: playerState })

        playerState.onQuit(() => {
          sprite.destroy()
          this.players = this.players.filter((p) => p.state !== playerState)
        })
      })
    }
    EventBus.emit('current-scene-ready', this)
  }

  spawnProjectile(type: string) {
    const vector = new Phaser.Math.Vector2()
    Phaser.Math.RandomXY(vector)
    let x, y
    const angle = vector.angle()
    if (angle < 1.57) {
      x = 0
      y = Math.abs(vector.y) * 1080
    } else if (angle < 3.14) {
      x = Math.abs(vector.x) * 1000
      y = 0
    } else if (angle < 4.712) {
      x = 1920
      y = Math.abs(vector.y) * 1080
    } else {
      x = Math.abs(vector.x) * 1000
      y = 1080
    }
    const randomPoint = this.edgeCircle?.getRandomPoint()
    if (!randomPoint) return
    vector.setAngle(Phaser.Math.Angle.Between(x, y, randomPoint.x, randomPoint.y))
    const rect = this.matter.add
      .image(x, y, type)
      .setRotation(vector.angle())
      .setScale(0.5)
      .setVelocity(vector.x * 3, vector.y * 3)
      .setFixedRotation()
      .setFriction(0)
      .setFrictionAir(0)
      .setCollisionCategory(this.projectileCollissionGroup)
      .setCollidesWith([this.playerCollisionGroup])
      .setSensor(true)
      .setOnCollide((event: Phaser.Types.Physics.Matter.MatterCollisionData) => {
        const playerBody = event.bodyA.gameObject
        if (!playerBody) return

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

    this.projectiles = [...this.projectiles, { gameObject: rect, type: type }]
    console.log(this.projectiles)
  }

  update(time: number) {
    if (isHost()) {
      const alivePlayers: string[] = getState('alivePlayers')
      const ezSpawnTime: number = getState('ezSpawnTime')
      const ezUltSpawnTime = getState('ezUltSpawnTime')
      if (time % ezSpawnTime == 0) {
        this.spawnProjectile('ezrealQ')
      }
      if (time % ezUltSpawnTime == 0) {
        this.spawnProjectile('ezrealUlt')
      }
      setState(
        'projectiles',
        this.projectiles.map((projectile) => {
          return {
            rot: projectile.gameObject.rotation,
            x: projectile.gameObject.x,
            y: projectile.gameObject.y,
            type: projectile.type,
          }
        })
      )

      for (const player of this.players) {
        if (player.sprite.active) {
          const joystick = player.state.getState('joystick') || { x: 0, y: 0, force: 0 }

          player.sprite.setVelocity(
            Phaser.Math.Clamp(2 * joystick.x * joystick.force, -15, 15),
            Phaser.Math.Clamp(-2 * joystick.y * joystick.force, -15, 15)
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
    } else if (this.registry.get('isDesktop')) {
      const projectilesPos = getState('projectiles')
      const range = projectilesPos.length - this.projectiles.length
      if (range > 0) {
        const projectiles = projectilesPos.slice(projectilesPos.length - range)
        projectiles.forEach((projectile: { rot: number; x: number; y: number; type: string }) => {
          const projectileObject = this.matter.add
            .image(projectile.x, projectile.y, projectile.type)
            .setRotation(projectile.rot)
            .setScale(0.5)
            .setFixedRotation()
          this.projectiles = [
            ...this.projectiles,
            { gameObject: projectileObject, type: projectile.type },
          ]
        })
      }

      this.projectiles.forEach((projectile, i) => {
        projectile.gameObject.setPosition(projectilesPos[i].x, projectilesPos[i].y)
      })
      const activePlayerIDs = getState('alivePlayers')
      for (const player of this.players) {
        if (!activePlayerIDs.includes(player.state.id)) {
          player.sprite.destroy()
        } else if (player.state.getState('active') == false) {
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

      if (isHost()) {
        this.time.delayedCall(4900, () => {
          setState('gameActive', false)
        })
      }

      this.time.delayedCall(5000, () => {
        if (isHost()) {
          resetPlayersStates(['spectator'])
          resetStates(['originalHostID', 'spectators'])
        }
        this.joystick?.destroy()
        this.scene.stop('MainMenu')
        this.scene.start('Preloader')
      })
    }
  }
}
