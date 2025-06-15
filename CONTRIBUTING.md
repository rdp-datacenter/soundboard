# Contributing to RDP Soundboard

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a new branch for your feature/fix
4. **Make** your changes
5. **Test** thoroughly
6. **Submit** a pull request

## Development Setup

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build the project
npm run build
```

## Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public methods
- Use meaningful commit messages

## Adding Commands

1. Create your command in the appropriate subfolder:
   - Audio commands: `src/commands/audio/`
   - Admin commands: `src/commands/admin/`
   - Utility commands: `src/commands/utility/`

2. Export both slash and text command versions if applicable

3. Follow the existing command structure:
```typescript
export const myCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('My command description'),
  
  async execute(interaction, context) {
    // Implementation
  }
};
```

## Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes you made and why
- **Testing**: Describe how you tested your changes
- **Screenshots**: Include screenshots for UI changes

## Bug Reports

When reporting bugs, please include:
- Discord.js version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Error logs (if any)

## Feature Requests

- Check existing issues first
- Describe the use case
- Explain why it would benefit users
- Consider backward compatibility

## Questions?

Feel free to open an issue for questions or join our Discord server!


## .github/ISSUE_TEMPLATE/bug_report.md

```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: 'bug'
assignees: ''
---

Describe the bug
A clear and concise description of what the bug is.

To Reproduce
Steps to reproduce the behavior:
1. Run command '...'
2. Click on '....'
3. See error

Expected behavior
A clear and concise description of what you expected to happen.

Screenshots
If applicable, add screenshots to help explain your problem.

Environment:
 - OS: [e.g. Windows 10, Ubuntu 20.04]
 - Node.js version: [e.g. 18.17.0]
 - Discord.js version: [e.g. 14.19.3]
 - Bot version/commit: [e.g. v1.0.0 or commit hash]

Error Logs
```
Paste any error logs here
```
Additional context
Add any other context about the problem here.
```