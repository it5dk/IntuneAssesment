

## Project Structure

- scripts/        PowerShell scripts
- modules/        Reusable modules (.psm1)
- .backups/       Timestamped zip backups
- CHANGELOG.md    Versioned changes
- VERSION         Current semantic version
- project.json    Project metadata

## Usage

- Save work and bump version:
  ./Template.ps1 save "feat: description"

- Show status:
  ./Template.ps1 status

## Conventions

- Conventional Commits: feat:, fix:, docs:, refactor:, perf:, test:
- Breaking change: use feat!: or include 'BREAKING CHANGE' in message.
