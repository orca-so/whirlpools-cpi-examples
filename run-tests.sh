#!/bin/bash

# Define color codes
BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments - now just for potential future extensions
for arg in "$@"
do
  case $arg in
    *)
    # Unknown option
    ;;
  esac
done

# Simple function to execute a command and return its exit code
run_cmd() {
  eval "$@"
  return $?
}

echo -e "${BLUE}==== Anchor Version Selection ====${NC}"
echo -e "${CYAN}Please select an Anchor version:${NC}"
echo -e "${GREEN}1) v0.29.0${NC}"
echo -e "${GREEN}2) v0.30.1${NC}"
echo -e "${GREEN}3) v0.31.0${NC}"
read -p "$(echo -e ${YELLOW}Enter your choice \(1-3\): ${NC})" choice

case $choice in
  1)
    ANCHOR_VERSION="v0.29.0"
    CARGO_SOURCE="Cargo.anchor-v0_29_0.toml"
    NEEDS_PATCH=true
    SOLANA_CLI_VERSION="v1.18.17"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v1.18.17/install)\""
    ;;
  2)
    ANCHOR_VERSION="v0.30.1"
    CARGO_SOURCE="Cargo.anchor-v0_30_1.toml"
    NEEDS_PATCH=true
    SOLANA_CLI_VERSION="v1.18.17"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v1.18.17/install)\""
    ;;
  3)
    ANCHOR_VERSION="v0.31.0"
    CARGO_SOURCE="Cargo.anchor-v0_31_0.toml"
    NEEDS_PATCH=false
    SOLANA_CLI_VERSION="v2.1.0"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v2.1.0/install)\""
    ;;
  *)
    echo -e "${RED}Invalid selection. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}Selected Anchor version: ${YELLOW}$ANCHOR_VERSION${NC}"
echo -e "${GREEN}Using Solana CLI version: ${YELLOW}$SOLANA_CLI_VERSION${NC}"

# Navigate to anchor-program directory
echo -e "${BLUE}=== Navigating to anchor-program directory ===${NC}"
cd anchor-program

# Clean up target directory and Cargo.lock
echo -e "${BLUE}=== Cleaning up previous build artifacts... ===${NC}"
if [ -d "target" ]; then
  echo -e "${RED}Removing target directory${NC}"
  rm -rf target
fi

if [ -f "Cargo.lock" ]; then
  echo -e "${RED}Removing Cargo.lock file${NC}"
  rm Cargo.lock
fi

# Copy the appropriate Cargo.toml file
echo -e "${BLUE}=== Setting up Cargo configuration ===${NC}"
echo -e "${CYAN}Copying $CARGO_SOURCE to programs/whirlpool-cpi/Cargo.toml${NC}"
cp "programs/whirlpool-cpi/$CARGO_SOURCE" "programs/whirlpool-cpi/Cargo.toml"

# Apply patch if needed
if [ "$NEEDS_PATCH" = true ]; then
  echo -e "${BLUE}=== Applying solana-program patch ===${NC}"
  echo -e "${CYAN}Applying solana-program patch for Anchor $ANCHOR_VERSION${NC}"
  cargo update solana-program@2.2.1 --precise 1.18.17
  echo -e "${GREEN}✓ Patch applied${NC}"
else
  echo -e "${CYAN}No patch needed for ${YELLOW}$ANCHOR_VERSION${NC}"
fi

# Install the correct Solana CLI version
echo -e "${BLUE}=== Installing Solana CLI $SOLANA_CLI_VERSION ===${NC}"
echo -e "${CYAN}Installing Solana CLI $SOLANA_CLI_VERSION for Anchor $ANCHOR_VERSION${NC}"
eval $SOLANA_INSTALL_CMD
echo -e "${GREEN}✓ Solana CLI installed${NC}"

# Continue with the rest of the build and test process
echo -e "${BLUE}=== Building Anchor project ===${NC}"
echo -e "${CYAN}Building Anchor project${NC}"
anchor build
echo -e "${GREEN}✓ Anchor build complete${NC}"

echo -e "${BLUE}=== Setting up Solana Kit client ===${NC}"
cd ../clients/solana-kit
echo -e "${CYAN}Installing dependencies with yarn${NC}"
yarn install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${BLUE}=== Copying program binary to test fixtures ===${NC}"
cp ../../anchor-program/target/deploy/whirlpool_cpi.so tests/fixtures/
echo -e "${GREEN}✓ Program binary copied${NC}"

echo -e "${BLUE}=== Generating codama client ===${NC}"
echo -e "${CYAN}Generating codama client${NC}"
node codama/codama.js
echo -e "${GREEN}✓ Codama client generated${NC}"

echo -e "${BLUE}=== Running tests ===${NC}"
echo -e "${CYAN}Running tests${NC}"
yarn test
echo -e "${GREEN}✓ Tests completed${NC}"

