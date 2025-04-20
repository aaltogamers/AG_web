import { Scene } from 'phaser'
import { EventBus } from '../EventBus'
import { getState, isHost, Joystick, myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'
import nipplejs from 'nipplejs'
import { useEffect } from 'react'

const currentLetter = getState('letter')

export class MainMenu extends Scene {
  controls = {}
  players: { sprite: Phaser.GameObjects.Rectangle; state: PlayerState; joystick: Joystick }[] = []

  constructor() {
    super('MainMenu')
  }
  create() {
    onPlayerJoin((playerState) => {
      const joystick = new Joystick(playerState, {
        type: 'dpad',
        buttons: [
          {
            id: 'jump',
            label: 'jump',
          },
        ],
      })
      this.addPlayer(playerState, joystick)
    })
    this.add.image(350, 540, 'background')
    EventBus.emit('current-scene-ready', this)
  }

  addPlayer(playerState: PlayerState, joystick: Joystick) {
    const sprite = this.add.rectangle(this.players.length, 0, 20, 20, 0)
    this.physics.add.existing(sprite, false)
    sprite.body.setCollideWorldBounds(true)
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
    // 3. Pass your game state to Playroom.
    if (isHost()) {
      for (const player of this.players) {
        const controls = player.joystick
        const body = player.sprite.body
        if (controls.dpad().x == 'left') {
          body.setVelocityX(-160)
        } else if (controls.dpad().x == 'right') {
          body.setVelocityX(160)
        } else {
          body.setVelocityX(0)
        }

        if (controls.isPressed('jump') && player.sprite.body.onFloor()) {
          body.setVelocityY(-330)
        }
        player.state.setState('pos', {
          x: body.x,
          y: body.y,
        })
      }
    } else {
      for (const player of this.players) {
        const pos = player.state.getState('pos')
        if (pos) {
          player.sprite.body.x = pos.x
          player.sprite.body.y = pos.y
        }
      }
    }
  }
}
