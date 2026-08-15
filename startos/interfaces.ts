import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  httpInterfaceId,
  mainHostId,
  sshInterfaceId,
  sshPort,
  uiPort,
} from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  // One host carries both interfaces, so main.ts can resolve the web address
  // and the SSH port from a single subscription.
  const multi = sdk.MultiHost.of(effects, mainHostId)

  // Web UI, the REST/GraphQL API, and git-over-HTTPS all share nginx on 80.
  // StartOS terminates TLS, so this binds plaintext and the OS publishes https.
  const httpOrigin = await multi.bindPort(uiPort, { protocol: 'http' })
  const httpInterface = sdk.createInterface(effects, {
    name: i18n('Web UI and Git over HTTPS'),
    id: httpInterfaceId,
    description: i18n(
      'The GitLab web interface. Also serves the API and git clone/push over HTTPS.',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })
  const httpReceipt = await httpOrigin.export([httpInterface])

  // git-over-SSH. Requesting 22 externally is only a request — if the port is
  // taken, StartOS assigns another and main.ts feeds the assigned one back to
  // GitLab as gitlab_shell_ssh_port so the clone URLs it prints stay correct.
  const sshOrigin = await multi.bindPort(sshPort, {
    protocol: 'ssh',
    preferredExternalPort: sshPort,
  })
  const sshInterface = sdk.createInterface(effects, {
    name: i18n('Git over SSH'),
    id: sshInterfaceId,
    description: i18n(
      'Clone and push over SSH using a key added to your GitLab profile.',
    ),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: 'git',
    path: '',
    query: {},
  })
  const sshReceipt = await sshOrigin.export([sshInterface])

  return [httpReceipt, sshReceipt]
})
