# Contributing to vscode2telegram

## Welcome! 🎉

Thank you for your interest in contributing to vscode2telegram!

## How to Contribute

### Reporting Bugs
1. Check if the issue already exists
2. Create a detailed issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

### Suggesting Features
1. Open an issue with `feature` label
2. Describe the use case
3. Propose implementation approach

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Ensure all tests pass: `npm test`
6. Run linter: `npm run lint`
7. Submit PR with clear description

## Development Setup

```bash
# Clone
git clone https://github.com/Liangwei-zhang/vscode2telegram.git
cd vscode2telegram

# Install
npm install

# Dev
npm run dev

# Test
npm test
```

## Code Style

- Use TypeScript with strict mode
- Use Prettier for formatting
- Add types (avoid `any`)
- Write tests for new features

## License

By contributing, you agree to license under MIT.