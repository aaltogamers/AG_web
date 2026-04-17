import { Scene } from 'phaser'
import { characterNames } from '../constants'
import {
  getState,
  isHost,
  myPlayer,
  onPlayerJoin,
  PlayerState,
  RPC,
  setState,
  transferHost,
  waitForPlayerState,
} from 'playroomkit'
import QRCode from 'qrcode'
import { initRPCs, mainMenuRef, setBootRef } from '../rpc'

export class Boot extends Scene {
  myID = myPlayer().id
  doOnce = false
  rpcInit = false
  isVisible = true
  async createRoomQR() {
    const url = window.location.href
    const qrDataURL = await QRCode.toDataURL(url)
    this.textures.addBase64('qr', qrDataURL)
  }

  constructor() {
    super('Boot')
  }

  moveToSpectator(id: string) {
    const player = this.registry.get('players').find((p: PlayerState) => p.id == id)
    if (!player) return
    this.registry.set('spectators', [...this.registry.get('spectators'), player])
    this.registry.set(
      'players',
      this.registry
        .get('players')
        .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
    )
  }

  moveToPlayer(id: string) {
    const player = this.registry.get('spectators').find((p: PlayerState) => p.id == id)
    if (!player) return

    this.registry.set('players', [...this.registry.get('players'), player])
    this.registry.set(
      'spectators',
      this.registry
        .get('spectators')
        .filter((storedPlayer: PlayerState) => storedPlayer.id != player.id)
    )
  }

  init() {
    this.registry.set('players', [])
    this.registry.set('spectators', [])
    this.registry.set(
      'isDesktop',
      this.scene.systems.game.device.os.desktop || this.scene.systems.game.device.os.iPad
    )
    if (!this.registry.get('isDesktop')) {
      this.scale.resize(1920, window.innerHeight)
    }
    if (!this.rpcInit) {
      initRPCs(this.registry.get('isDesktop'))
      this.rpcInit = true
    }
    setBootRef(this)

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
        { key: 'corkiRocket', url: '/images/games/corkiRocket.webp' },
        { key: 'jinxUlt', url: '/images/games/jinxUlt.webp' },
        { key: 'luxQ', url: '/images/games/luxQ.webp' },
        { key: 'pickBorder', url: '/images/games/pickBorder.webp' },
        { key: 'spellShield', url: '/images/games/spellShield.webp' },
        { key: 'spawnAltar', url: '/images/games/spawnAltar.webp' },
        { key: 'background', url: '/images/games/arena.webp' },
        ...characterNames.map((name) => {
          return { key: name, url: `/images/games/${name}.webp` }
        }),
      ],
      audio: [
        { key: 'champSelect', url: '/music/champSelect.webm' },
        { key: 'inGame', url: '/music/pledgeOfDemon.webm' },
      ],
      font: [{ key: 'Goldman', url: '/fonts/Goldman-Regular.ttf' }],
    }
    this.load.image(files.images)
    this.load.audio(files.audio)
    this.load.font(files.font)
    this.createRoomQR()
  }
  create() {
    if (isHost()) {
      setState('originalHostID', this.myID)
    }

    this.game.events.on('hidden', () => {
      this.isVisible = false
      if (isHost()) {
        RPC.call('togglePause', true)
      }
    })

    this.game.events.on('visible', async () => {
      this.isVisible = true
      if (isHost()) {
        RPC.call('togglePause', false)
      } else if (getState('gameActive')) {
        await RPC.call('getProjectiles', '', RPC.Mode.HOST, (data) => {
          mainMenuRef?.reSyncProjectiles(data)
        })
      }
    })

    this.game.events.on('destroy', () => {
      RPC.call('togglePause', false)
    })

    onPlayerJoin((player) => {
      waitForPlayerState(player, 'name', () => {
        if (
          !this.registry
            .get('players')
            .find((storedPlayer: PlayerState) => storedPlayer.id == player.id) &&
          !this.registry
            .get('spectators')
            .find((storedPlayer: PlayerState) => storedPlayer.id == player.id)
        ) {
          const registry = player.getState('spectator') ? 'spectators' : 'players'
          this.registry.set(registry, [...this.registry.get(registry), player])
          if (isHost() && player.id == getState('originalHostID')) {
            transferHost(player.id)
          }
        }
        player.onQuit(() => {
          if (myPlayer()?.id) {
            if (isHost() && player.id != myPlayer().id && this.isVisible) {
              RPC.call('togglePause', false)
            }
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

              if (isHost()) {
                if (player.getState('ready')) {
                  setState(
                    'picked',
                    getState('picked').filter((a: string) => a != player.getState('character'))
                  )
                  RPC.call('pickedChamp', player.getState('character'))
                }
                const alivePlayers = getState('alivePlayers').filter(
                  (alivePlayerID: string) => alivePlayerID != player.id
                )
                setState('alivePlayers', alivePlayers)
                if (alivePlayers.length <= 0) {
                  setState('winner', player.id)
                  RPC.call('gameWon', '')
                }
              }
            }
          }
        })
      })
    })

    if (getState('gameActive')) {
      this.add.text(750, 540, 'game in progress ... \n please wait for the next round to start')
    } else {
      this.scene.start('Preloader')
    }
  }
  update() {
    if (getState('alivePlayers').includes(myPlayer().id)) {
      this.scene.start('Preloader')
    }
    if (!getState('gameActive') && !this.doOnce) {
      this.doOnce = true
      this.time.delayedCall(5000, () => this.scene.start('Preloader'))
    }
  }
}
