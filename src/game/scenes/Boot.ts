import { Scene } from 'phaser'
import { characterNames } from '../constants'
import {
  getState,
  isHost,
  myPlayer,
  PlayerState,
  RPC,
  setState,
  transferHost,
  waitForPlayerState,
} from 'playroomkit'
import QRCode from 'qrcode'
import { initRPCs, mainMenuRef, setBootRef } from '../rpc'
import { playerList } from '../AudienceGame'

export class Boot extends Scene {
  myID = myPlayer().id
  doOnce = false
  isVisible = true
  async createRoomQR() {
    const url = window.location.href
    const qrDataURL = await QRCode.toDataURL(url)
    this.textures.addBase64('qr', qrDataURL)
  }

  constructor() {
    super('Boot')
  }

  reSyncPlayers(players: PlayerState[]) {
    const registryPlayers: PlayerState[] = this.registry
      .get('players')
      .filter((p: PlayerState) => !players.includes(p))
    const registrySpectators: PlayerState[] = this.registry
      .get('spectators')
      .filter((p: PlayerState) => !players.includes(p))
    const newPlayers: PlayerState[] = players.filter(
      (p) =>
        !this.registry.get('players').includes(p) && !this.registry.get('spectators').includes(p)
    )

    registryPlayers.forEach((p) => this.removePlayer(p))
    registrySpectators.forEach((p) => this.removePlayer(p))
    newPlayers.forEach((p) => {
      this.moveToRegistry(p)
    })
  }

  removePlayer(player: PlayerState) {
    if (myPlayer()?.id) {
      if (isHost() && player.id != myPlayer().id && this.isVisible) {
        RPC.call('togglePause', false)
      }

      Phaser.Utils.Array.Remove(this.registry.get('players'), player)
      Phaser.Utils.Array.Remove(this.registry.get('spectators'), player)

      if (isHost()) {
        if (player.getState('ready')) {
          setState(
            'picked',
            getState('picked').filter((a: string) => a != player.getState('character'))
          )
          setState(
            'ready',
            getState('ready').filter((id: string) => id != player.id)
          )
          RPC.call('pickedChamp', player.getState('character'))
        }

        RPC.call('killPlayer', player.id)
      }
    }
  }

  moveToSpectator(id: string) {
    if (this.registry.get('spectators').some((p: PlayerState) => p.id == id)) return

    const player = this.registry.get('players').find((p: PlayerState) => p.id == id)
    if (!player) return
    if (player.id == myPlayer().id) myPlayer().setState('spectator', true)
    Phaser.Utils.Array.Remove(this.registry.get('players'), player)
    Phaser.Utils.Array.Add(this.registry.get('spectators'), player)
  }

  moveToPlayer(id: string) {
    if (this.registry.get('players').some((p: PlayerState) => p.id == id)) return

    const player = this.registry.get('spectators').find((p: PlayerState) => p.id == id)
    if (!player) return
    if (player.id == myPlayer().id) myPlayer().setState('spectator', false)

    Phaser.Utils.Array.Remove(this.registry.get('spectators'), player)
    Phaser.Utils.Array.Add(this.registry.get('players'), player)
  }

  moveToRegistry(player: PlayerState) {
    if (!player.getState('name')) {
      waitForPlayerState(player, 'name', () => {
        this.moveToRegistry(player)
      })
    } else {
      if (
        !this.registry
          .get('players')
          .some((storedPlayer: PlayerState) => storedPlayer.id == player.id) &&
        !this.registry
          .get('spectators')
          .some((storedPlayer: PlayerState) => storedPlayer.id == player.id)
      ) {
        const registry = player.getState('spectator') ? 'spectators' : 'players'
        Phaser.Utils.Array.Add(this.registry.get(registry), player)
        setState(player.id, player.getState('name'))

        if (isHost() && player.id == getState('originalHostID')) {
          transferHost(player.id)
        }
      }
      player.onQuit(() => {
        this.removePlayer(player)
      })
    }
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

    initRPCs(this.registry.get('isDesktop'))

    setBootRef(this)

    const pos: [number, number] = this.registry.get('isDesktop')
      ? [940, 540]
      : [1920 - window.innerWidth / 2, window.innerHeight / 2]

    this.add.text(...pos, 'loading ...').setOrigin(0.5, 0.5)

    if (getState('gameActive')) {
      if (isHost()) {
        RPC.call('togglePause', true)
      }
      if (!getState('alivePlayers').includes(myPlayer().id)) {
        RPC.call('moveToSpectator', myPlayer().id, RPC.Mode.ALL)
      }
    }
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

    this.load.font(files.font)
    this.load.image(files.images)
    this.load.audio(files.audio)
    this.createRoomQR()
  }
  async create() {
    if (isHost()) {
      setState('originalHostID', this.myID)
    }

    this.game.events.on('hidden', () => {
      this.isVisible = false
      if (isHost()) {
        RPC.call('togglePause', true)
        setState('paused', true)
      }
    })

    this.game.events.on('visible', async () => {
      this.isVisible = true
      if (isHost()) {
        RPC.call('togglePause', false)
        setState('paused', false)
      } else if (getState('gameActive') && this.registry.get('isDesktop')) {
        await RPC.call('getProjectiles', '', RPC.Mode.HOST, (data) => {
          mainMenuRef?.reSyncProjectiles(data)
        })
      }
    })
    this.reSyncPlayers(playerList)

    this.scene.start('Preloader')
  }
}
