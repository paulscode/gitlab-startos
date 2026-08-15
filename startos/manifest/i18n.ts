// Descriptions shown in the marketplace. LocaleString accepts either a plain
// string or a per-locale record; this package ships English and adds locales as
// contributors provide them, rather than machine-translating technical terms.
// Length limits: short <= 80 chars, long <= 500.
export const short = {
  en_US: 'Self-hosted Git forge with issues, merge requests and CI/CD',
}

export const long = {
  en_US:
    'GitLab is a complete DevOps platform: Git hosting with a web interface, issue tracking, merge requests, wikis, and a built-in CI/CD engine. This package runs the official Community Edition, which bundles PostgreSQL, Redis and Gitaly, so it has no service dependencies. Clone over HTTPS or SSH. Pair it with the GitLab Runner package to execute CI/CD pipelines on your own hardware.',
}
