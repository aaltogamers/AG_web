import { Scene } from 'phaser'
import {
  getState,
  isHost,
  myPlayer,
  PlayerState,
  resetPlayersStates,
  resetStates,
  RPC,
  setState,
  waitForState,
} from 'playroomkit'
import nipplejs from 'nipplejs'
import { smallAbilities, bigAbilities } from '../constants'

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
  projectiles: Phaser.Physics.Matter.Image[] = []
  projectileSpeed = 3
  edgeCircle: Phaser.Geom.Circle | undefined = undefined
  pointText: Phaser.GameObjects.Text | undefined = undefined
  scaler: Phaser.Time.TimerEvent | undefined = undefined

  winMessagePos = { x: 960, y: 540 }
  deathMessagePos = {
    x: 800,
    y: 200,
    message: () => `You Died with \n  ${myPlayer()?.getState('points')} points`,
    settings: {
      fontFamily: 'goldman',
      fontSize: 40,
    },
  }
  constructor() {
    super('MainMenu')
  }

  waitForGameWon() {
    waitForState('gameWon', () => {
      if (this.registry.get('isDesktop')) {
        const id = getState('winner')
        const winner = this.playerStates.find((p) => p.id == id)
        this.add
          .text(
            this.winMessagePos.x,
            this.winMessagePos.y,
            winner?.getState('name') + ' won \n with ' + winner?.getState('points') + ' points',
            {
              fontFamily: 'goldman',
              fontSize: 100,
              align: 'center',
            }
          )
          .setOrigin(0.5, 0.5)
      }

      if (isHost()) {
        setState('gameActive', false)
        resetPlayersStates(['spectator', 'points', 'name'])
        resetStates([
          ...this.playerStates.map((p) => p.id),
          ...this.registry.get('spectators').map((p: PlayerState) => p.id),
          'originalHostID',
          'spectators',
          'projectiles',
          'winner',
          'points',
        ])
        this.scaler?.remove()
      }

      this.time.delayedCall(5000, () => {
        this.sound.stopAll()
        this.joystick?.destroy()
        this.scene.stop('MainMenu')
        this.scene.start('Preloader')
        this.projectiles.forEach((p) => p.destroy(true))
        this.hitboxes.forEach((p) => p.destroy(true))
        myPlayer()?.setState('joystick', { x: 0, y: 0, force: 0 })

        this.projectiles = []
      })
    })
  }

  spawnProjectile(type: { name: string; speed: number }) {
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
      .image(x, y, type.name)
      .setRotation(vector.angle())
      .setScale(0.5)
      .setVelocity(vector.x * type.speed, vector.y * type.speed)
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
        player.state.setState('points', getState('points'))

        if (player.state.id == myPlayer()?.id) {
          this.add.text(
            this.deathMessagePos.x,
            this.deathMessagePos.y,
            this.deathMessagePos.message(),
            this.deathMessagePos.settings
          )
        }

        setState(
          'alivePlayers',
          getState('alivePlayers').filter(
            (alivePlayerID: string) => alivePlayerID != player.state.id
          )
        )
      })
      .setName(type.name)
    this.projectiles.push(rect)
    RPC.call(
      'spawnClientProjectile',
      {
        x: rect.x,
        y: rect.y,
        rotation: rect.rotation,
        speed: type.speed,
        name: type.name,
      },
      RPC.Mode.OTHERS
    )
  }

  init() {
    this.joystick = nipplejs.create({})
    this.players = []
    this.projectiles = []
    RPC.register('spawnClientProjectile', async (data) => {
      if (this.registry.get('isDesktop')) {
        const projectile = data
        const { x, y } = radToXY(projectile.rotation)
        const projectileObject = this.matter.add
          .image(projectile.x, projectile.y, projectile.name)
          .setRotation(projectile.rotation)
          .setScale(0.5)
          .setFixedRotation()
          .setCollisionCategory(this.projectileCollissionGroup)
          .setCollidesWith([this.playerCollisionGroup])
          .setSensor(true)
          .setVelocity(x * projectile.speed, y * projectile.speed)
          .setFriction(0)
          .setFrictionAir(0)

        this.projectiles.push(projectileObject)
      }
      return 'ok'
    })
  }

  create() {
    this.playerStates = this.registry.get('players')

    if (myPlayer().getState('spectator')) {
      this.joystick?.destroy()
      this.add
        .text(10, 10, 'spectating', {
          fontFamily: 'goldman',
          fontSize: 30,
        })
        .setDepth(10)
    } else {
      this.joystick?.on('move', (_, data) => {
        const angle = radToXY(data.angle.radian)
        myPlayer()?.setState('joystick', { ...angle, force: data.force })
      })
      this.joystick?.on('end', () => {
        myPlayer()?.setState('joystick', { x: 0, y: 0, force: 0 })
      })
    }
    if (!this.registry.get('isDesktop')) {
      this.add.rectangle(0, 0, 1920, window.innerHeight, 0x2b2b2b).setOrigin(0, 0)
      if (myPlayer().getState('spectator')) {
        this.add
          .text(1300, window.innerHeight / 2, 'spectating', {
            fontFamily: 'goldman',
            fontSize: 100,
          })
          .setOrigin(0.5, 0.5)
      } else {
        this.add.image(1300, window.innerHeight / 2, 'touchIcon').setScale(0.5)
      }
    } else {
      this.sound.play('inGame', {
        loop: true,
        volume: 0.05,
      })
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
        if (playerState.getState('active')) {
          const character: string = playerState.getState('character')

          const sprite = this.matter.add
            .image(960, 540, character, undefined, {
              shape: {
                type: 'circle',
                radius: 340,
              },
            })
            .setScale(0.08)
            .setBounce(0)
            .setFixedRotation()
            .setCollisionCategory(this.playerCollisionGroup)
            .setName(playerState.id)

          this.players.push({ sprite, state: playerState })

          playerState.onQuit(() => {
            sprite.destroy()
            this.players = this.players.filter((p) => p.state !== playerState)
          })
        }
      })
      this.pointText = this.add.text(1650, 10, 'Points: 0', {
        fontFamily: 'goldman',
        fontSize: 30,
      })
    }
    if (isHost()) {
      this.scaler = this.time.addEvent({
        delay: 10000,
        callback: () => {
          const smallTime = Math.max(1, getState('smallSpell') * 0.8)
          const bigTime = Math.max(1, getState('bigSpell') * 0.8)

          setState('smallSpell', smallTime)
          setState('BigSpell', bigTime)
        },
        loop: true,
      })
    }
    this.waitForGameWon()
  }

  update(_: number, delta: number) {
    if (isHost()) {
      const alivePlayers: string[] = getState('alivePlayers')
      const roundedDelta = Math.round(delta)
      const points = getState('points') + roundedDelta

      setState('points', points)
      setState('projectiles', this.projectiles)

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

        if (alivePlayers.length == 1 && !getState('gameWon')) {
          setState('winner', alivePlayers[0])
        } else if (alivePlayers.length <= 0 && !getState('gameWon')) {
          setState('gameWon', true)
        }
      }

      const smallAccumulator = getState('smallAccumulator')
      const bigAccumulator = getState('bigAccumulator')
      setState('smallAccumulator', smallAccumulator - roundedDelta)
      setState('bigAccumulator', bigAccumulator - roundedDelta)

      if (smallAccumulator <= 0) {
        const i = Phaser.Math.RND.between(0, smallAbilities.length - 1)
        this.spawnProjectile(smallAbilities[i])
        setState('smallAccumulator', getState('smallSpell'))
      }
      if (bigAccumulator <= 0) {
        const i = Phaser.Math.RND.between(0, bigAbilities.length - 1)
        this.spawnProjectile(bigAbilities[i])
        setState('bigAccumulator', getState('bigSpell'))
      }

      this.pointText?.setText(`Points: ${points}`)
    } else if (this.registry.get('isDesktop')) {
      const activePlayerIDs = getState('alivePlayers')
      for (const player of this.players) {
        if (!activePlayerIDs.includes(player.state.id)) {
          player.sprite.destroy()
        } else if (player.state.getState('active') == false) {
          player.sprite.destroy(true)
          if (player.state.id == myPlayer()?.id) {
            this.joystick?.destroy()
            this.add.text(
              this.deathMessagePos.x,
              this.deathMessagePos.y,
              this.deathMessagePos.message(),
              this.deathMessagePos.settings
            )
          }
        }

        const pos = player.state.getState('pos')

        if (pos && player.sprite.body) {
          player.sprite.setPosition(pos.x, pos.y)
        }
      }
      const points = getState('points')
      this.pointText?.setText(`Points: ${points}`)
    }
  }
}
