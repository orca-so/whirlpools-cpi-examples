# Orca CPI Examples 🌊

A comprehensive toolkit for developers looking to integrate the Orca Whirlpools Program into their own on-chain Anchor Programs.

## 🌟 Highlights

- CPI (Cross-Program Invocation) examples for multiple Anchor versions:
  - v0.29.0
  - v0.30.1
  - v0.31.0
- Client-side code for generating instruction data and account information using both:
  - `@solana/web3.js`
  - `@solana/kit`
- **Specific Use Case**: For Launchpad creators who want to graduate tokens from their bonding curve to Orca Whirlpools. See [use-cases/Launchpad.md](./use-cases/Launchpad.md) for detailed implementation.

## 🏗️ Program Implementation

The Anchor program demonstrates how to properly invoke the Orca Whirlpools Program from your own Anchor program.

### Solana CLI and Anchor Version Compatibility

Each Anchor version requires a specific Solana CLI version:

| Anchor Version | Solana CLI Version |
| -------------- | ------------------ |
| v0.29.0        | v1.18.17           |
| v0.30.1        | v1.18.17           |
| v0.31.0        | v2.1.0             |

### Rust Version Compatibility

- **Anchor v0.29.0 and v0.30.1**: Tested with Rust versions 1.78 - 1.82. Programs will not build with newer Rust versions.
- **Anchor v0.31.0**: Compatible with newer Rust versions.

### Setting Up the Correct Environment

#### 1. Install the Appropriate Solana CLI Version

```bash
# For Anchor v0.29.0 and v0.30.1
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.17/install)"

# For Anchor v0.31.0
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
```

#### 2. Install and Use the Correct Anchor Version with AVM

```bash
# Install Anchor Version Manager (if not already installed)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install and use the appropriate Anchor version
avm use <version>  # Replace <version> with 0.29.0, 0.30.1, or 0.31.0
```

### ⚠️ Important: Solana Program Dependency Patching

For Anchor versions 0.29.0 and 0.30.1, you **must patch** the `solana-program` crate:

- **Why?** These Anchor versions rely on `solana-program` crate < v2, while the Orca Whirlpools and Whirlpools SDK pull in `solana-program` > v2, creating version conflicts.
- **Solution:** Apply the patch by first determining the latest version and then downgrading it:

  ```bash
  # Get the latest solana-program version
  LATEST_SOLANA_PROGRAM=$(cargo search solana-program --limit 1 | grep -o "solana-program = \"[0-9.]*\"" | cut -d '"' -f 2)

  # Apply the patch
  cargo update solana-program@$LATEST_SOLANA_PROGRAM --precise 1.18.17
  ```

For Anchor version 0.31.0, **no patching is required** as it's compatible with `solana-program` > v2.

### Building the Program

```bash
# Copy the appropriate Cargo.toml file for your Anchor version
cp programs/whirlpool-cpi/Cargo.anchor-v0_XX_X.toml programs/whirlpool-cpi/Cargo.toml

# Build the program
anchor build
```

## 💻 Client Implementations

### 🧰 Solana Kit Client

The `@solana/kit` client leverages modern Solana SDK features.

#### Features:

- **Automated Anchor Client Generation** using Codama
- Integration with `@orca-so/whirlpools` SDK for Whirlpools interactions
- Test suite using `Bankrun` for simulation without a local validator

#### Setup and Testing:

```bash
# Navigate to the kit client directory
cd clients/solana-kit

# Install dependencies
yarn install

# Copy program binary to test fixtures
cp ../../anchor-program/target/deploy/whirlpool_cpi.so tests/fixtures/

# Generate Codama client
node codama/codama.js

# Run tests
yarn test
```

### 🕸️ Web3.js Client

The classic `@solana/web3.js` implementation with Anchor.

#### Features:

- Integration with Anchor for account management and instruction creation
- Testing framework using Vitest
- RPC mocking utilities in the Utils directory

#### Dependency Management:

- **Important Note:** The `@orca-so/whirlpools-sdk` is dependent on Anchor v0.29.0
- For other Anchor versions, the `package.json` includes `resolutions` to manage dependency conflicts

#### Setup and Testing:

```bash
# Navigate to the web3.js client directory
cd clients/solana-web3js

# Copy the appropriate package.json for your Anchor version
cp package.anchor-v0_XX_X.json package.json

# Install dependencies
yarn install

# Run tests
yarn test
```

## 🚀 Running the Complete Test Suite

The `run-tests.sh` script automates all the setup and testing steps:

```bash
# Make the script executable
chmod +x run-tests.sh

# Run the script
./run-tests.sh
```

The script will:

1. Prompt you to select an Anchor version
2. Set up the correct Solana CLI and Anchor environment
3. Apply necessary patches (for v0.29.0 and v0.30.1)
4. Build the Anchor program
5. Set up and test both client implementations

## 📚 Additional Resources

- [Orca Whirlpools Documentation](https://dev.orca.so/)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
