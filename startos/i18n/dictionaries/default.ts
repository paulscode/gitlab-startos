export const DEFAULT_LANG = 'en_US'

const dict = {
  'Allow this runner to pick up jobs that specify no tags. Usually what you want for a single runner.': 0,
  'Changing this rewrites the clone URLs GitLab shows. Existing local clones keep working, but their remotes will point at the old address until updated.': 1,
  'Choose which of your addresses GitLab treats as canonical. It is baked into clone URLs, generated links and outgoing email.': 2,
  'Clone and push over SSH using a key added to your GitLab profile.': 3,
  'Comma-separated tags. Jobs can target a runner by tag; leave blank for none.': 4,
  'Configure Email': 5,
  'Could not create the runner. Check the service logs.': 6,
  'Could not reset the password. Check the service logs.': 7,
  'Create Runner Token': 8,
  'Email Settings Saved': 9,
  'Generate a new password for the built-in "root" administrator and display it.': 10,
  'Git over SSH': 11,
  'GitLab is ready': 12,
  'GitLab is still starting. First boot takes several minutes.': 13,
  'GitLab refused to create the runner: ': 14,
  'Give this token to your runner. It is shown once; GitLab does not store a retrievable copy.': 15,
  'How this runner is labelled in the GitLab admin area.': 16,
  'Initial Credentials': 17,
  'No generated password is on record. Use Reset Root Password to set a new one.': 18,
  'No web address is available yet. Enable one in the Interfaces tab.': 19,
  'Not Available': 20,
  'Primary URL': 21,
  'Primary URL Set': 22,
  'Register a new CI/CD runner and return its authentication token.': 23,
  'Reset Root Password': 24,
  'Restart GitLab for the new address to take effect. Reconfiguration takes a couple of minutes.': 25,
  'Restart GitLab to apply the new mail settings. Reconfiguration takes a couple of minutes.': 26,
  'Retrieve the generated root password and sign in for the first time': 27,
  'Root Password Reset': 28,
  'Run Untagged Jobs': 29,
  'Runner Name': 30,
  'Runner Token': 31,
  'Save this password now — it is not stored and cannot be shown again.': 32,
  'Set Primary URL': 33,
  'Set the outgoing mail server GitLab uses for sign-up confirmations, password resets and notifications.': 34,
  'Show the password generated for the built-in "root" administrator at install.': 35,
  'Sign in as "root" with this password, then change it from your GitLab profile.': 36,
  'Starting GitLab!': 37,
  'Store not found': 38,
  'Tags': 39,
  'The GitLab web interface. Also serves the API and git clone/push over HTTPS.': 40,
  'The address GitLab treats as canonical is no longer available. Choose another.': 41,
  'This replaces the current root password immediately. Anyone relying on the old one will be locked out.': 42,
  'Web Interface': 43,
  'Web UI and Git over HTTPS': 44,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
