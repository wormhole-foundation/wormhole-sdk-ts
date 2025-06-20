# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Wormhole SDK TypeScript repository - a monorepo containing the official TypeScript SDK for the Wormhole cross-chain messaging protocol. The SDK provides a unified interface for interacting with Wormhole across multiple blockchain platforms.

## Build and Development Commands

### Essential Commands
```bash
# Install dependencies (run at root)
npm install

# Build all packages
npm run build

# Run tests (uses NETWORK=Mainnet by default)
npm run test

# Run integration tests with local Wormhole (requires Tilt)
npm run test:tilt

# Lint and fix code
npm run lint

# Format code with prettier
npm run prettier

# Generate TypeDoc documentation
npm run docs

# Clean and rebuild everything
npm run rebuild
```

### Running Individual Package Tests
```bash
# Run tests for a specific package
cd packages/[package-name]
npm test

# Run tests with coverage
npm run coverage
```

### Working with Turbo
The project uses Turbo for monorepo task orchestration. When making changes that affect multiple packages, Turbo will handle the build order automatically.

## Architecture Overview

### Package Structure
- `core/base`: Core constants, utilities, and base functionality (@wormhole-foundation/sdk-base)
- `core/definitions`: VAA structures, protocol definitions, and core types (@wormhole-foundation/sdk-definitions)
- `connect`: Main SDK interface, route resolution, and transfer management (@wormhole-foundation/sdk-connect)
- `platforms/`: Platform-specific implementations (evm, solana, cosmwasm, algorand, aptos, sui)
- `protocols/`: Protocol implementations for each platform (tokenBridge, cctp, gateway, etc.)
- `sdk`: Meta-package that exports all functionality (@wormhole-foundation/sdk)

### Key Architectural Concepts

1. **Platform vs Chain**: A Platform represents a blockchain runtime (e.g., EVM), while a Chain is a specific blockchain instance (e.g., Ethereum, BSC)

2. **Universal vs Native Addresses**: The SDK uses 32-byte universal addresses internally and converts to/from platform-specific native addresses

3. **Context Pattern**: `ChainContext` and `PlatformContext` provide chain-specific functionality and configuration

4. **Protocol Registration**: Protocols are registered with platforms and accessed through the main Wormhole interface

5. **Transfer Abstraction**: `WormholeTransfer` provides high-level transfer functionality with automatic route resolution

### TypeScript Patterns

- **Strict Type Safety**: All code uses TypeScript strict mode with comprehensive type checking
- **Generic Network/Chain Types**: Extensive use of generics for compile-time network and chain validation
- **Type Imports**: Always use `import type` for type-only imports (enforced by ESLint)

### Code Style

- 2 spaces for indentation
- 100 character line width
- Double quotes for strings
- Trailing commas in multi-line structures
- Semicolons required
- camelCase for file names, PascalCase for classes/types

### Testing Approach

- Jest for all testing
- Unit tests in `__tests__/unit/` directories
- Integration tests in `__tests__/integration/` directories
- Mock utilities available in `testing/mocks/`
- Tests should cover both happy paths and error cases

### Common Development Tasks

1. **Adding a new chain to existing platform**:
   - Update chain definitions in `core/base/src/chains/index.ts`
   - Add chain-specific configuration in the platform package
   - Update protocol implementations if needed

2. **Implementing a new protocol**:
   - Create protocol directory under the platform
   - Implement the protocol interface
   - Register with the platform in its index
   - Add tests for all functionality

3. **Updating VAA structures**:
   - Modify layouts in `core/definitions/src/vaa/`
   - Update serialization/deserialization logic
   - Ensure backward compatibility

### Important Files to Know

- `core/base/src/constants/chains.ts`: Chain IDs and configurations
- `core/base/src/constants/contracts.ts`: Core contract addresses
- `connect/src/wormhole.ts`: Main SDK entry point
- `connect/src/routes/`: Route resolution logic
- Platform-specific signers in `platforms/[platform]/src/signer.ts`

### Debugging Tips

- Enable verbose logging by checking individual package implementations
- Use the examples in `examples/` as reference implementations
- Check integration tests for usage patterns
- VAA parsing errors often indicate version mismatches or incorrect payload formats

### Working with VAAs

VAAs (Verified Action Approvals) are the core message format in Wormhole:
- Serialization/deserialization in `core/definitions/src/vaa/`
- Layout definitions use a custom layout system for binary encoding
- Always validate VAAs before processing
- Guardian signatures must be verified for production use

### Network Configuration

- Tests default to Mainnet configuration
- Set `NETWORK=Testnet` environment variable for testnet
- Chain configurations are in `core/base/src/constants/chains.ts`
- RPC endpoints are configured per platform

This SDK prioritizes type safety, cross-chain abstraction, and developer experience while maintaining the flexibility needed for platform-specific operations.