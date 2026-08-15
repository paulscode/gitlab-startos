import { sdk } from '../sdk'
import { setDependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'
import { seedStore } from './seedStore'
import { setPrimaryUrl } from './setPrimaryUrl'

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  // The store must exist before anything reads it — including `actions`, whose
  // metadata is evaluated here at init rather than on each invocation. Seeding
  // after that point leaves actions holding decisions made against an absent
  // store until the next init.
  seedStore,
  setInterfaces,
  setDependencies,
  actions,
  // Runs last: it needs the interfaces above to have been exported before it
  // can ask which addresses exist.
  setPrimaryUrl,
)

export const uninit = sdk.setupUninit(versionGraph)
