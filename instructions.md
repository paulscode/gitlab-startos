# GitLab

## Documentation

- [GitLab user documentation](https://docs.gitlab.com/user/) — how to use projects, merge requests, issues and the rest of the interface.
- [GitLab administration documentation](https://docs.gitlab.com/administration/) — the admin area, user management and instance settings.
- [GitLab CI/CD documentation](https://docs.gitlab.com/ci/) — writing `.gitlab-ci.yml` pipelines.
- [Omnibus configuration reference](https://docs.gitlab.com/omnibus/settings/) — every setting available in `/etc/gitlab/gitlab.rb`.

## What you get

A complete, private Git forge: repositories with a web interface, issues, merge requests, wikis, a package registry and a CI/CD engine — all running on your own hardware, with no external accounts involved.

Two ways to reach it:

- **Web UI and HTTPS cloning** — the main interface, and the address you use for `git clone https://…`.
- **SSH cloning** — `git clone git@…` once you have added an SSH key to your profile.

## Getting set up

GitLab takes several minutes to start the first time — usually around four, sometimes longer. It is unpacking and configuring PostgreSQL, Redis and half a dozen other services, then running database migrations. This is normal and only happens once; later starts take about twenty seconds.

1. Wait for the service to report that it is running.
2. Run the **Initial Credentials** action and copy the password. Your username is `root`.
3. Open the web interface and sign in.
4. Change the root password from your GitLab profile once you are in.

That is enough to start creating projects.

## Choosing your address

GitLab bakes a single address into the clone URLs it displays, the links in its pages, and any email it sends. On install this is set to your LAN address, which works immediately.

If you want to reach GitLab over Tor or your own domain and have those links be correct, run the **Set Primary URL** action, pick the address you want, and restart the service. You can still reach GitLab at all of its addresses either way — this only controls which one it uses when it writes a link.

If the address you picked ever stops being available, GitLab will ask you to choose a new one before it starts again.

## Sending email

Password resets, sign-up confirmations and notification emails all need an outgoing mail server. Run **Configure Email** to point GitLab at either the mail relay configured on your server or an SMTP account of your own, then restart the service.

Without this, GitLab works normally but sends nothing — which matters most if you invite other people, since they will not receive their invitations.

## Cloning over SSH

Add your public key to your GitLab profile under **Preferences → SSH Keys**, then use the SSH address shown for this service.

Note that the port is usually not the standard 22, because that port is normally already in use on your server. GitLab shows the correct clone command with the right port on each project page, so copying it from there is the reliable approach.

## Running CI/CD pipelines

Pipelines need a runner — a separate program that executes your jobs. Install the **GitLab Runner** package and it will connect itself to this GitLab automatically.

If instead you want to attach a runner on some other machine, run the **Create Runner Token** action here and give that token to the runner. The token is displayed once and cannot be retrieved afterwards, so copy it before closing the dialog.

## Things to know

- **The container registry is turned off.** Pushing Docker images to this GitLab is not available in this package.
- **GitLab Pages is turned off.** Publishing static sites from your repositories is not available.
- **Settings changes need a restart.** The actions here save your choice immediately, but GitLab applies its configuration while starting up, so the change takes effect on the next start — and that start takes a couple of minutes.
- **Give it room.** GitLab uses around 3 GB of memory at idle. If your server is running many other services, expect it to feel slow.
- **Don't leave updates for years.** GitLab limits how far it will jump in a single upgrade. If you fall a long way behind, an update may refuse to start and tell you which older release to install first — follow it, then update again, repeating until it succeeds. Nothing is lost when this happens, but it is easier to just update reasonably often.
