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
} from 'playroomkit'
import nipplejs from 'nipplejs'
import { smallAbilities, bigAbilities, characterNames } from '../constants'
import { setMainMenuRef } from '../rpc'
import { Preloader } from './Preloader'

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
  shieldCollisionGroup: number = 8
  projectileSpeed = 3
  edgeCircle: Phaser.Geom.Circle | undefined = undefined
  pointText: Phaser.GameObjects.Text | undefined = undefined
  scaler: Phaser.Time.TimerEvent | undefined = undefined
  shieldSpawner: Phaser.Time.TimerEvent | undefined = undefined
  smallAccumulator = getState('smallAccumulator')
  bigAccumulator = getState('bigAccumulator')
  points = getState('points')
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
  shield: Phaser.Physics.Matter.Image | undefined = undefined
  playerShields: Map<string, Phaser.GameObjects.Image> = new Map()

  constructor() {
    super('MainMenu')
  }

  usedShield(id: string) {
    const shield = this.playerShields.get(id)
    if (!shield) return
    const player = this.players.find((p) => p.state.id == id)
    if (!player) return

    player.sprite.setTintFill(0xa4d0fc)

    this.time.delayedCall(100, () => {
      player.sprite.clearTint()
    })
    shield.destroy()
    this.playerShields.delete(id)
  }

  getShield(id: string) {
    const player = this.players.find((p) => p.state.id == id)
    if (!player) return
    if (!this.shield) return

    this.shield.setCollidesWith(0).setPosition(player.sprite.x, player.sprite.y).setScale(0.37)

    this.playerShields.set(id, this.shield)

    this.shield = undefined
  }

  spawnShield() {
    if (this.shield) return

    const shield = this.matter.add
      .image(940, 550, 'spellShield', undefined, {
        shape: {
          type: 'circle',
          radius: 80,
        },
      })
      .setSensor(true)
      .setCollidesWith(this.playerCollisionGroup)
      .setFixedRotation()
      .setFriction(0)
      .setFrictionAir(0)
      .setScale(0.45)
      .setCollisionGroup(this.shieldCollisionGroup)

    if (isHost()) {
      shield.setOnCollide((event: Phaser.Types.Physics.Matter.MatterCollisionData) => {
        const playerBody = event.bodyA.gameObject
        if (!playerBody) return
        const player = this.players.find((p) => p.sprite.name === playerBody.name)
        if (!player) return

        if (this.playerShields.get(player.state.id)) return

        RPC.call('getShield', player.state.id)
      })
    }
    this.shield = shield
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
      .setBounce(0)
      .setOnCollide((event: Phaser.Types.Physics.Matter.MatterCollisionData) => {
        const playerBody = event.bodyA.gameObject
        if (!playerBody) return

        const player = this.players.find((p) => p.sprite.name === playerBody.name)
        if (!player) return

        const shield = this.playerShields.get(player.state.id)

        if (shield) {
          RPC.call('usedShield', player.state.id)
          return
        }

        RPC.call('killPlayer', player.state.id, RPC.Mode.ALL)
        player.state.setState('points', this.points)
        setState(
          'alivePlayers',
          getState('alivePlayers').filter(
            (alivePlayerID: string) => alivePlayerID != player.state.id
          )
        )
        const alivePlayers = getState('alivePlayers')

        if (alivePlayers.length <= 0) {
          setState('winner', player.state.id)
          RPC.call('gameWon', '', RPC.Mode.ALL)
        }
      })
      .setName(type.name)
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
  // called from rpc.ts
  spawnClientProjectile(data: {
    rotation: number
    x: number
    y: number
    name: string
    speed: number
  }) {
    const projectile = data
    const { x, y } = radToXY(projectile.rotation)
    this.matter.add
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
  }

  // called from rpc.ts
  gameWon() {
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
        'winner',
        'points',
        'difficulty',
      ])
      this.scaler?.remove()
      this.shieldSpawner?.remove()
    }

    this.time.delayedCall(5000, () => {
      this.sound.stopAll()
      this.joystick?.destroy()
      if (!this.scene.get('Preloader')) {
        this.scene.add('Preloader', Preloader)
      }
      this.scene.start('Preloader')
      this.matter.world.remove(this.matter.world.getAllBodies())

      this.scene.remove('MainMenu')
      setMainMenuRef(undefined)

      myPlayer()?.setState('joystick', { x: 0, y: 0, force: 0 })
    })
  }

  // called from rpc.ts
  killPlayer(data: string) {
    const playerToKill = this.players.find((p) => p.state.id == data)
    playerToKill?.sprite?.destroy()
    if (data == myPlayer().id) {
      this.joystick?.destroy()
      this.add.text(
        this.deathMessagePos.x,
        this.deathMessagePos.y,
        this.deathMessagePos.message(),
        this.deathMessagePos.settings
      )
    }
  }

  init() {
    setMainMenuRef(this)
    if (!myPlayer().getState('spectator')) {
      this.joystick?.destroy()
      this.joystick = nipplejs.create({})
    }
    this.players = []

    this.smallAccumulator = getState('smallAccumulator')
    this.bigAccumulator = getState('bigAccumulator')
    this.points = getState('points')
  }

  create() {
    this.playerStates = this.registry.get('players')

    if (myPlayer().getState('spectator')) {
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
    if (!this.registry.get('isDesktop') && !isHost()) {
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
      this.add.image(940, 550, 'spawnAltar').setScale(0.55)

      this.playerStates.forEach((playerState) => {
        if (playerState.getState('active')) {
          const character: string = playerState.getState('character') || characterNames[0]
          const sprite = this.matter.add
            .image(940, 550, character, undefined, {
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
      if (!this.registry.get('isDesktop')) {
        this.add.rectangle(0, 0, 1920, window.innerHeight, 0x2b2b2b).setOrigin(0, 0).setDepth(100)
        if (myPlayer().getState('spectator')) {
          this.add
            .text(1300, window.innerHeight / 2, 'spectating', {
              fontFamily: 'goldman',
              fontSize: 100,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(100)
        } else {
          this.add
            .image(1300, window.innerHeight / 2, 'touchIcon')
            .setScale(0.5)
            .setDepth(100)
        }
      }
    }

    if (isHost()) {
      this.shieldSpawner = this.time.addEvent({
        delay: 15000,
        callback: () => {
          RPC.call('spawnShield', '')
        },
        loop: true,
      })
      this.scaler = this.time.addEvent({
        delay: 10000,
        callback: () => {
          const smallTime = Math.max(1, getState('smallSpell') * 0.8)
          const bigTime = Math.max(1, getState('bigSpell') * 0.8)
          setState('smallSpell', smallTime)
          setState('bigSpell', bigTime)
        },
        loop: true,
      })
    }
  }

  update(_: number, delta: number) {
    if (isHost()) {
      const roundedDelta = Math.round(delta / 5)
      this.points += roundedDelta

      setState('points', this.points)

      for (const player of this.players) {
        const shield = this.playerShields.get(player.state.id)
        if (shield) {
          shield.setPosition(player.sprite.x, player.sprite.y)
        }
        if (player.sprite.active) {
          const joystick = player.state.getState('joystick') || { x: 0, y: 0, force: 0 }

          player.sprite.setVelocity(
            Phaser.Math.Clamp(2 * joystick.x * joystick.force, -10, 10),
            Phaser.Math.Clamp(-2 * joystick.y * joystick.force, -10, 10)
          )
          player.state.setState('pos', {
            x: player.sprite.x,
            y: player.sprite.y,
          })
        }
      }

      this.smallAccumulator -= roundedDelta
      this.bigAccumulator -= roundedDelta

      if (this.smallAccumulator <= 0) {
        for (let a = 0; a < Phaser.Math.RND.between(1, 3); a++) {
          const i = Phaser.Math.RND.between(0, smallAbilities.length - 1)
          this.spawnProjectile(smallAbilities[i])
        }
        const cooldown = getState('smallSpell')
        this.smallAccumulator = cooldown
        setState('smallAccumulator', cooldown)
      }
      if (this.bigAccumulator <= 0) {
        for (let a = 0; a < Phaser.Math.RND.between(1, 3); a++) {
          const i = Phaser.Math.RND.between(0, bigAbilities.length - 1)
          this.spawnProjectile(bigAbilities[i])
        }
        const cooldown = getState('bigSpell')
        this.bigAccumulator = cooldown
        setState('bigAccumulator', cooldown)
      }

      this.pointText?.setText(`Points: ${this.points}`)
    } else if (this.registry.get('isDesktop')) {
      for (const player of this.players) {
        const shield = this.playerShields.get(player.state.id)
        if (shield) {
          shield.setPosition(player.sprite.x, player.sprite.y)
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
