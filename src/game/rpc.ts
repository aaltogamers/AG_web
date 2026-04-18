import { isHost, RPC } from 'playroomkit'
import { Boot } from './scenes/Boot'
import { MainMenu } from './scenes/MainMenu'
import { Preloader } from './scenes/Preloader'

export let bootRef: Boot | undefined = undefined
export let preloaderRef: Preloader | undefined = undefined
export let mainMenuRef: MainMenu | undefined = undefined

let rpcsInitialized = false

export const setBootRef = (ref: Boot | undefined) => {
  bootRef = ref
}

export const setPreloaderRef = (ref: Preloader | undefined) => {
  preloaderRef = ref
}

export const setMainMenuRef = (ref: MainMenu | undefined) => {
  mainMenuRef = ref
}

export const resetRPCs = () => {
  bootRef = undefined
  preloaderRef = undefined
  mainMenuRef = undefined
}
export const initRPCs = (isDesktop: boolean) => {
  if (rpcsInitialized) return
  rpcsInitialized = true

  RPC.register('moveToSpectator', async (id) => {
    bootRef?.moveToSpectator(id)
  })
  RPC.register('moveToPlayer', async (id) => {
    bootRef?.moveToPlayer(id)
  })
  RPC.register('startGame', async () => {
    preloaderRef?.startGame()
  })
  RPC.register('pickedChamp', async (data) => {
    preloaderRef?.drawChamp(data)
  })
  RPC.register('gameWon', async () => {
    mainMenuRef?.gameWon()
  })
  RPC.register('killPlayer', async (data) => {
    mainMenuRef?.killPlayer(data)
  })
  RPC.register('togglePause', async (data) => {
    mainMenuRef?.togglePause(data)
  })
  if (isDesktop || isHost()) {
    RPC.register('spawnProjectile', async (data) => {
      mainMenuRef?.spawnProjectile(data)
    })
    RPC.register('getShield', async (data) => {
      mainMenuRef?.getShield(data)
    })
    RPC.register('spawnShield', async () => {
      mainMenuRef?.spawnShield()
    })
    RPC.register('usedShield', async (data) => {
      mainMenuRef?.usedShield(data)
    })
    RPC.register('getProjectiles', async () => {
      return mainMenuRef?.getProjectiles()
    })
  }
}
