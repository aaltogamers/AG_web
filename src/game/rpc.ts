import { RPC } from 'playroomkit'
import { Boot } from './scenes/Boot'
import { MainMenu } from './scenes/MainMenu'
import { Preloader } from './scenes/Preloader'

let bootRef: Boot | undefined = undefined
let preloaderRef: Preloader | undefined = undefined
let mainMenuRef: MainMenu | undefined = undefined

export const setBootRef = (ref: Boot) => {
  bootRef = ref
}

export const setPreloaderRef = (ref: Preloader) => {
  preloaderRef = ref
}

export const setMainMenuRef = (ref: MainMenu) => {
  mainMenuRef = ref
}

export const resetRPCs = () => {
  bootRef = undefined
  preloaderRef = undefined
  mainMenuRef = undefined
}

export const initRPCs = (isDesktop: boolean) => {
  if (bootRef && preloaderRef && mainMenuRef) {
    resetRPCs()
    return
  }

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
  if (isDesktop) {
    RPC.register('spawnClientProjectile', async (data) => {
      mainMenuRef?.spawnClientProjectile(data)
    })
  }
}
