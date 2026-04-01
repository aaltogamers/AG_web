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
  waitForPlayerState,
} from 'playroomkit'

export class Boot extends Scene {
  myID = myPlayer().id
  i = 0
  constructor() {
    super('Boot')
  }
  init() {
    this.registry.set('players', [])
    this.registry.set('spectators', [])
    this.registry.set(
      'isDesktop',
      this.scene.systems.game.device.os.desktop || this.scene.systems.game.device.os.iPad
    )
    this.add.text(850, 600, 'loading ...')
  }

  preload() {
    const files = {
      images: [
        { key: 'ezrealQ', url: '/images/games/ezrealq.webp' },
        { key: 'ezrealUlt', url: '/images/games/ezrealUlt.webp' },
        { key: 'lockInButtonActive', url: '/images/games/LockInButtonActive.webp' },
        { key: 'lockInButtonInactive', url: '/images/games/LockInButtonInactive.webp' },
        { key: 'pickBackground', url: '/images/games/pickBackground.webp' },
        { key: 'touchIcon', url: '/images/games/touchIcon.webp' },
      ],
      audio: [
        { key: 'champSelect', url: '/music/champSelect.webm' },
        { key: 'inGame', url: '/music/pledgeOfDemon.webm' },
      ],
    }
    this.load.font('Goldman', '/fonts/Goldman-Regular.ttf')
    this.load.image('background', '/images/games/arena.webp')
    characterNames.forEach((character) => {
      this.load.image(character, `/images/games/${character}.webp`)
    })

    this.load.image(files.images)
    this.load.audio(files.audio)
  }
  create() {
    if (isHost()) {
      setState('originalHostID', this.myID)
    }
    this.registry.set('players', [myPlayer()])
    onPlayerJoin((player) => {
      waitForPlayerState(player, 'name', () => {
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
          if (myPlayer()?.id) {
            if (player.getState('spectator')) {
              this.registry.set(
                'spectators',
                this.registry
                  .get('spectators')
                  .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
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
                getState('alivePlayers').filter(
                  (alivePlayerID: string) => alivePlayerID != player.id
                )
              )
            }
          }
        })
      })
    })
    if (getState('gameActive')) {
      this.add.text(750, 540, 'game in progress ... \n please wait for the next round to start')
    }
  }
  update() {
    if (!getState('gameActive')) {
      this.scene.start('Preloader')
    }
  }
}
