import { sdk } from '../sdk'
import { configureSmtp } from './configureSmtp'
import { createRunnerToken } from './createRunnerToken'
import { createRunnerTokenAuto } from './createRunnerTokenAuto'
import { resetRootPassword } from './resetRootPassword'
import { setPrimaryUrl } from './setPrimaryUrl'
import { showInitialCredentials } from './showInitialCredentials'

export const actions = sdk.Actions.of()
  .addAction(showInitialCredentials)
  .addAction(setPrimaryUrl)
  .addAction(resetRootPassword)
  .addAction(configureSmtp)
  .addAction(createRunnerToken)
  .addAction(createRunnerTokenAuto)
