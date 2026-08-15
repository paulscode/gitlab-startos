export const DEFAULT_LANG = 'en_US'

const dict = {
  'Allow this runner to pick up jobs that specify no tags. Usually what you want for a single runner.': 0,
  'Changing this rewrites the clone URLs GitLab shows. Existing local clones keep working, but their remotes will point at the old address until updated.': 1,
  'Choose which of your addresses GitLab treats as canonical. It is baked into clone URLs, generated links and outgoing email.': 2,
  'Clone and push over SSH using a key added to your GitLab profile.': 3,
  'Comma-separated tags. Jobs can target a runner by tag; leave blank for none.': 4,
  'Configure Email': 5,
  'Could not reset the password: ': 6,
  'Create Runner Token': 7,
  'Email Settings Saved': 8,
  'Generate a new password for the built-in "root" administrator and display it.': 9,
  'Git over SSH': 10,
  'GitLab is ready': 11,
  'GitLab is still starting. First boot takes several minutes.': 12,
  'GitLab refused to create the runner: ': 13,
  'Give this token to your runner. It is shown once; GitLab does not store a retrievable copy.': 14,
  'How this runner is labelled in the GitLab admin area.': 15,
  'Initial Credentials': 16,
  'No generated password is on record. Use Reset Root Password to set a new one.': 17,
  'No web address is available yet. Enable one in the Interfaces tab.': 18,
  'Not Available': 19,
  'Primary URL': 20,
  'Primary URL Set': 21,
  'Register a new CI/CD runner and return its authentication token.': 22,
  'Reset Root Password': 23,
  'Restart GitLab for the new address to take effect. Reconfiguration takes a couple of minutes.': 24,
  'Restart GitLab to apply the new mail settings. Reconfiguration takes a couple of minutes.': 25,
  'Retrieve the generated root password and sign in for the first time': 26,
  'Root Password Reset': 27,
  'Run Untagged Jobs': 28,
  'Runner Name': 29,
  'Runner Token': 30,
  'Save this password now — it is not stored and cannot be shown again.': 31,
  'Set Primary URL': 32,
  'Set the outgoing mail server GitLab uses for sign-up confirmations, password resets and notifications.': 33,
  'Show the password generated for the built-in "root" administrator at install.': 34,
  'Sign in as "root" with this password, then change it from your GitLab profile.': 35,
  'Starting GitLab!': 36,
  'Store not found': 37,
  'Tags': 38,
  'The GitLab web interface. Also serves the API and git clone/push over HTTPS.': 39,
  'The address GitLab treats as canonical is no longer available. Choose another.': 40,
  'This replaces the current root password immediately. Anyone relying on the old one will be locked out.': 41,
  'Web Interface': 42,
  'Web UI and Git over HTTPS': 43,
} as const

/**
 * Plumbing. DO NOT EDIT.
 */
export type I18nKey = keyof typeof dict
export type LangDict = Record<(typeof dict)[I18nKey], string>
export default dict
