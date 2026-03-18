import { Scene } from 'phaser'
import { characterNames } from '../constants'
import { getState, isHost, myPlayer, onPlayerJoin, PlayerState } from 'playroomkit'

export class Boot extends Scene {
  currentHostID: string = ''
  constructor() {
    super('Boot')
  }
  preload() {
    this.load.image('background', '/images/games/midlane2.png')
    characterNames.forEach((character) => {
      this.load.image(character, `/images/games/${character}.png`)
    })
  }
  create() {
    this.registry.set('players', [myPlayer()])
    onPlayerJoin((player) => {
      if (
        !this.registry
          .get('players')
          .find((storedPlayer: PlayerState) => storedPlayer.id == player.id)
      ) {
        this.registry.set('players', [...this.registry.get('players'), player])
      }
      player.onQuit(() => {
        this.registry.set(
          'players',
          this.registry
            .get('players')
            .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
        )
        if (isHost()) {
          console.log(player.id)
          this.registry.set(
            'alivePlayers',
            this.registry
              .get('alivePlayers')
              .filter((alivePlayer: string) => alivePlayer != player.id)
          )
          console.log(this.registry.get('alivePlayers'))
        }
      })
    })
    if (getState('gameActive')) {
      this.add.text(300, 300, 'game in progress ... \n please wait for the next round to start')
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
