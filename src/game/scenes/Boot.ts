import { Scene } from 'phaser'
import { characterNames } from '../constants'
import {
  getState,
  isHost,
  myPlayer,
  onPlayerJoin,
  PlayerState,
  setState,
  transferHost,
} from 'playroomkit'

export class Boot extends Scene {
  constructor() {
    super('Boot')
  }
  init() {
    this.registry.set('players', [])
    this.registry.set('spectators', [])
  }

  preload() {
    this.load.image('background', '/images/games/arena.png')
    characterNames.forEach((character) => {
      this.load.image(character, `/images/games/${character}.png`)
    })
    this.load.image('ezrealQ', '/images/games/ezrealq.png')
  }
  create() {
    if (isHost()) {
      setState('originalHostID', myPlayer().id)
    }
    this.registry.set('players', [myPlayer()])
    onPlayerJoin((player) => {
      if (
        !this.registry
          .get('players')
          .find((storedPlayer: PlayerState) => storedPlayer.id == player.id)
      ) {
        this.registry.set('players', [...this.registry.get('players'), player])
        if (isHost() && player.id == getState('originalHostID')) {
          transferHost(player.id)
        }
      }
      player.onQuit(() => {
        if (player.getState('spectator')) {
          this.registry.set(
            'spectators',
            this.registry.get('spectators').filter((storedPlayer) => storedPlayer.id != player.id)
          )
        } else {
          this.registry.set(
            'players',
            this.registry
              .get('players')
              .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
          )
          setState(
            'alivePlayers',
            getState('alivePlayers').filter((alivePlayerID: string) => alivePlayerID != player.id)
          )
        }
      })
    })
    if (getState('gameActive') && myPlayer().id != getState('originalHostID')) {
      this.add.text(750, 540, 'game in progress ... \n please wait for the next round to start')
    } else {
      this.scene.start('Preloader')
    }
  }
  update() {
    if (!getState('gameActive')) {
      this.scene.start('Preloader')
    }
  }
}
