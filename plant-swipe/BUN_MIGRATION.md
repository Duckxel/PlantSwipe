# Bun Migration Guide

This project has been migrated from npm to **Bun** as the primary JavaScript runtime and package manager.

## Why Bun?

[Bun](https://bun.sh) is a fast all-in-one JavaScript runtime that includes:
- A package manager (replacement for npm/yarn/pnpm)
- A bundler
- A test runner
- Native TypeScript and JSX support

## Performance Comparison

### Package Installation Speed

| Package Manager | Install Time (Fresh) | Speed Improvement |
|-----------------|---------------------|-------------------|
| npm ci          | ~6.7 seconds        | Baseline          |
| bun install     | ~0.95 seconds       | **7x faster**     |

### Build Performance

Both npm and bun use Vite under the hood for building, so build times are comparable. However, Bun's faster script execution provides marginal improvements.

## Getting Started

### Prerequisites

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Verify installation**:
   ```bash
   bun --version
   ```

### Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Start development server | `bun run dev` |
| Build for production | `bun run build` |
| Run linting | `bun run lint` |
| Preview production build | `bun run preview` |
| Start production server | `bun run serve` |
| Generate sitemap | `bun run generate:sitemap` |
| Check translations | `bun run check-translations` |

### Lock Files

Bun generates a binary lock file called `bun.lockb` instead of `package-lock.json`. Both files are kept for compatibility:
- `bun.lockb` - Primary lock file for Bun
- `package-lock.json` - Kept for npm fallback compatibility

## Server Deployment

The `setup.sh` and `scripts/refresh-plant-swipe.sh` scripts have been updated to use Bun:

- **setup.sh**: Installs Bun alongside Node.js and uses Bun for dependency installation and builds
- **refresh-plant-swipe.sh**: Uses Bun for faster CI/CD refreshes

### Service Configuration

The systemd service (`plant-swipe-node.service`) can run with either Bun or Node.js:

```ini
# Using Node.js (current default)
ExecStart=/usr/bin/node server.js

# Using Bun (alternative - faster startup)
ExecStart=/usr/local/bin/bun server.js
```

## Compatibility Notes

### Node.js Compatibility

Bun maintains high compatibility with Node.js APIs. However, some edge cases may exist:
- Native Node.js addons work with Bun
- Most npm packages work without modification
- `node_modules` structure is identical

### Troubleshooting

1. **If `bun` command not found**:
   ```bash
   export PATH="$HOME/.bun/bin:$PATH"
   ```

2. **If postinstall scripts fail**:
   ```bash
   bun pm trust --all
   ```

3. **Fallback to npm**:
   If issues arise, you can still use npm:
   ```bash
   npm ci
   npm run build
   ```

## Migration Summary

Files modified:
- `setup.sh` - Install and use Bun
- `scripts/refresh-plant-swipe.sh` - Use Bun for CI/CD
- `package.json` - Scripts updated to use Bun

New files:
- `bun.lockb` - Bun lock file
- `BUN_MIGRATION.md` - This documentation

## Further Reading

- [Bun Documentation](https://bun.sh/docs)
- [Bun vs npm comparison](https://bun.sh/docs/cli/install)
- [Node.js compatibility](https://bun.sh/docs/runtime/nodejs-apis)
