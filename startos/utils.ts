import { utils } from '@start9labs/start-sdk'
import { sdk } from './sdk'

/**
 * Ports GitLab listens on *inside* its container.
 *
 * 80 is Omnibus nginx. StartOS terminates TLS in front of it, so nginx is
 * configured to serve plain HTTP here and trust X-Forwarded-Proto.
 *
 * 22 is the sshd the Omnibus image runs for git-over-SSH. The package has its
 * own network namespace, so binding 22 does not collide with the host's sshd.
 */
export const uiPort = 80
export const sshPort = 22

/**
 * Both interfaces hang off one host, so a single subscription resolves
 * everything main.ts needs from it. These three ids are the stable contract
 * that dependent packages (gitlab-runner) import — do not rename them without
 * bumping dependents.
 */
export const mainHostId = 'main'
export const httpInterfaceId = 'http'
export const sshInterfaceId = 'ssh'

/**
 * Omnibus keeps three separate state trees, and the image declares all three as
 * volumes. Mounting each as a subpath of the single `main` volume keeps every
 * piece of persistent state inside one backup set.
 *
 *   /etc/gitlab      generated gitlab.rb, secrets, SSH host keys
 *   /var/opt/gitlab  repositories, the Postgres cluster, uploads, LFS
 *   /var/log/gitlab  service logs (kept out of the container's ephemeral rootfs
 *                    so `gitlab-ctl tail` and log rotation behave across restarts)
 */
export const mount = sdk.Mounts.of()
  .mountVolume({
    volumeId: 'main',
    subpath: '/etc-gitlab',
    mountpoint: '/etc/gitlab',
    readonly: false,
  })
  .mountVolume({
    volumeId: 'main',
    subpath: '/var-opt-gitlab',
    mountpoint: '/var/opt/gitlab',
    readonly: false,
  })
  .mountVolume({
    volumeId: 'main',
    subpath: '/var-log-gitlab',
    mountpoint: '/var/log/gitlab',
    readonly: false,
  })

/**
 * A root password strong enough that GitLab's own validator accepts it, drawn
 * from the SDK's CSPRNG. Generated once at install and surfaced to the user
 * through the Initial Credentials action.
 */
export function generateRootPassword() {
  return utils.getDefaultString({
    charset: 'a-z,A-Z,2-9,!,@,%,*,-,_',
    len: 24,
  })
}

/**
 * The externally reachable HTTP URLs for this service, as StartOS knows them.
 * Backs the Set Primary URL picker and the init-time watcher that keeps the
 * stored choice honest.
 */
export function getHttpInterfaceUrls(
  effects: Parameters<typeof sdk.host.getOwn>[0],
): Promise<string[]> {
  return sdk.host
    .getOwn(effects, mainHostId, (host) => {
      const iface =
        host &&
        Object.values(host.bindings)
          .flatMap((b) => Object.values(b.interfaces))
          .find((i) => i.id === httpInterfaceId)
      return iface ? iface.addressInfo.nonLocal.format() : []
    })
    .const()
}
