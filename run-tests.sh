#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define color codes
BLUE='\033[1;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to check command status and exit on failure
check_status() {
  if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Previous command failed! Exiting.${NC}"
    exit 1
  fi
}

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
  local status=$?
  if [ $status -ne 0 ]; then
    echo -e "${RED}ERROR: Command '$@' failed with status $status! Exiting.${NC}"
    exit $status
  fi
  return $status
}

# Function to automatically respond "yes" to AVM installation prompts
auto_install_avm() {
  local version=$1
  echo -e "${CYAN}Setting up automatic yes response for AVM installation prompt${NC}"
  yes y | avm use $version
  if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install or switch to Anchor version $version! Exiting.${NC}"
    exit 1
  fi
  return 0
}

echo -e "${BLUE}==== Anchor Version Selection ====${NC}"
echo -e "${CYAN}Please select an Anchor version:${NC}"
echo -e "${GREEN}1) v0.29.0${NC}"
echo -e "${GREEN}2) v0.30.1${NC}"
echo -e "${GREEN}3) v0.31.1${NC}"
read -p "$(echo -e ${YELLOW}Enter your choice \(1-3\): ${NC})" choice

case $choice in
  1)
    ANCHOR_VERSION="v0.29.0"
    CARGO_SOURCE="Cargo.anchor-v0_29_0.toml"
    NEEDS_PATCH=true
    SOLANA_CLI_VERSION="v1.18.17"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v1.18.17/install)\""
    AVM_VERSION="0.29.0"
    PACKAGE_JSON_SOURCE="package.anchor-v0_29_0.json"
    ;;
  2)
    ANCHOR_VERSION="v0.30.1"
    CARGO_SOURCE="Cargo.anchor-v0_30_1.toml"
    NEEDS_PATCH=true
    SOLANA_CLI_VERSION="v1.18.17"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v1.18.17/install)\""
    AVM_VERSION="0.30.1"
    PACKAGE_JSON_SOURCE="package.anchor-v0_30_1.json"
    ;;
  3)
    ANCHOR_VERSION="v0.31.1"
    CARGO_SOURCE="Cargo.anchor-v0_31_1.toml"
    NEEDS_PATCH=false
    SOLANA_CLI_VERSION="v2.1.0"
    SOLANA_INSTALL_CMD="sh -c \"\$(curl -sSfL https://release.anza.xyz/v2.1.0/install)\""
    AVM_VERSION="0.31.1"
    PACKAGE_JSON_SOURCE="package.anchor-v0_31_1.json"
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

# Clean up target directory, Cargo.lock, and codama/generated directory
echo -e "${BLUE}=== Cleaning up previous build artifacts... ===${NC}"
if [ -d "target" ]; then
  echo -e "${RED}Removing target directory${NC}"
  rm -rf target
fi

if [ -f "Cargo.lock" ]; then
  echo -e "${RED}Removing Cargo.lock file${NC}"
  rm Cargo.lock
fi

if [ -d "../clients/solana-kit/codama/generated" ]; then
  echo -e "${RED}Removing clients/solana-kit/codama/generated directory${NC}"
  rm -rf "../clients/solana-kit/codama/generated"
fi

# Clean up web3js client project
if [ -d "../clients/solana-web3js/node_modules" ]; then
  echo -e "${RED}Removing clients/solana-web3js/node_modules directory${NC}"
  rm -rf "../clients/solana-web3js/node_modules"
fi

if [ -f "../clients/solana-web3js/yarn.lock" ]; then
  echo -e "${RED}Removing clients/solana-web3js/yarn.lock file${NC}"
  rm -rf "../clients/solana-web3js/yarn.lock"
fi

# Copy the appropriate Cargo.toml file
echo -e "${BLUE}=== Setting up Cargo configuration ===${NC}"
echo -e "${CYAN}Copying $CARGO_SOURCE to programs/whirlpool-cpi/Cargo.toml${NC}"
cp "programs/whirlpool-cpi/$CARGO_SOURCE" "programs/whirlpool-cpi/Cargo.toml"
check_status

# Install the correct Solana CLI version
echo -e "${BLUE}=== Installing Solana CLI $SOLANA_CLI_VERSION ===${NC}"
echo -e "${CYAN}Installing Solana CLI $SOLANA_CLI_VERSION for Anchor $ANCHOR_VERSION${NC}"
eval $SOLANA_INSTALL_CMD
check_status
echo -e "${GREEN}✓ Solana CLI installed${NC}"

# Download the Whirlpool program
echo -e "${BLUE}=== Downloading Whirlpool program ===${NC}"
echo -e "${CYAN}Downloading Whirlpool program from mainnet${NC}"
WHIRLPOOL_ADDRESS="whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"

# Create fixtures directories if they don't exist
mkdir -p ../clients/solana-kit/tests/fixtures/
mkdir -p ../clients/solana-web3js/tests/fixtures/

# Download the Whirlpool program
solana program -um dump $WHIRLPOOL_ADDRESS ../clients/solana-kit/tests/fixtures/whirlpool.so
check_status
solana program -um dump $WHIRLPOOL_ADDRESS ../clients/solana-web3js/tests/fixtures/whirlpool.so
check_status
echo -e "${GREEN}✓ Whirlpool program downloaded${NC}"

# Switch to the correct Anchor CLI version using AVM
echo -e "${BLUE}=== Setting up Anchor CLI version ===${NC}"
echo -e "${CYAN}Switching to Anchor CLI for $ANCHOR_VERSION${NC}"
echo -e "${CYAN}Using AVM to install/switch to version $AVM_VERSION if needed${NC}"
auto_install_avm $AVM_VERSION
echo -e "${GREEN}✓ Anchor CLI version set${NC}"

# Apply patch if needed
if [ "$NEEDS_PATCH" = true ]; then
  echo -e "${BLUE}=== Applying solana-program patch ===${NC}"
  echo -e "${CYAN}Applying solana-program patch for Anchor $ANCHOR_VERSION${NC}"
  
  # Get the latest solana-program version from cargo registry
  echo -e "${CYAN}Checking latest solana-program version from cargo registry...${NC}"
  LATEST_SOLANA_PROGRAM=$(cargo search solana-program --limit 1 | grep -o "solana-program = \"[0-9.]*\"" | cut -d '"' -f 2)
  
  if [ -z "$LATEST_SOLANA_PROGRAM" ]; then
    echo -e "${RED}ERROR: Failed to retrieve the latest solana-program version from cargo registry! Exiting.${NC}"
    exit 1
  fi
  
  echo -e "${CYAN}Found solana-program version: ${YELLOW}$LATEST_SOLANA_PROGRAM${NC}"
  echo -e "${CYAN}Applying patch: cargo update solana-program@$LATEST_SOLANA_PROGRAM --precise 1.18.17${NC}"
  
  cargo update solana-program@$LATEST_SOLANA_PROGRAM --precise 1.18.17
  check_status
  echo -e "${GREEN}✓ Patch applied${NC}"
else
  echo -e "${CYAN}No patch needed for ${YELLOW}$ANCHOR_VERSION${NC}"
fi

# Continue with the rest of the build and test process
echo -e "${BLUE}=== Building Anchor project ===${NC}"
echo -e "${CYAN}Building Anchor project${NC}"
anchor build
check_status
echo -e "${GREEN}✓ Anchor build complete${NC}"

echo -e "${BLUE}=== Setting up Solana Kit client ===${NC}"
cd ../clients/solana-kit
echo -e "${CYAN}Installing dependencies with yarn${NC}"
yarn install
check_status
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${BLUE}=== Copying program binary to test fixtures ===${NC}"
cp ../../anchor-program/target/deploy/whirlpool_cpi.so tests/fixtures/
check_status
echo -e "${GREEN}✓ Program binary copied${NC}"

echo -e "${BLUE}=== Generating codama client ===${NC}"
echo -e "${CYAN}Generating codama client${NC}"
node codama/codama.js
check_status
echo -e "${GREEN}✓ Codama client generated${NC}"

echo -e "${BLUE}=== Running tests ===${NC}"
echo -e "${CYAN}Running tests with retry mechanism${NC}"

# Run tests with retry logic (up to 3 attempts)
MAX_ATTEMPTS=3
ATTEMPT=1
TEST_SUCCESS=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ] && [ "$TEST_SUCCESS" = false ]; do
  echo -e "${YELLOW}Test attempt $ATTEMPT of $MAX_ATTEMPTS${NC}"
  
  if yarn test; then
    TEST_SUCCESS=true
    echo -e "${GREEN}✓ Tests completed successfully on attempt $ATTEMPT${NC}"
  else
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
      echo -e "${YELLOW}Tests failed on attempt $ATTEMPT. Waiting 5 seconds before retrying...${NC}"
      sleep 5
    else
      echo -e "${RED}Tests failed after $MAX_ATTEMPTS attempts. Exiting.${NC}"
      exit 1
    fi
  fi
  
  ATTEMPT=$((ATTEMPT+1))
done

# Navigate to web3js client project
echo -e "${BLUE}=== Setting up Web3.js client ===${NC}"
cd ../solana-web3js
echo -e "${CYAN}Copying appropriate package.json for Anchor ${YELLOW}$ANCHOR_VERSION${NC}"

echo -e "${CYAN}Copying $PACKAGE_JSON_SOURCE to package.json${NC}"
cp $PACKAGE_JSON_SOURCE package.json
check_status

echo -e "${CYAN}Installing dependencies with yarn${NC}"
yarn install
check_status
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${BLUE}=== Copying program binary to test fixtures ===${NC}"
cp ../../anchor-program/target/deploy/whirlpool_cpi.so tests/fixtures/
check_status
echo -e "${GREEN}✓ Program binary copied${NC}"

echo -e "${BLUE}=== Running Web3.js client tests ===${NC}"
echo -e "${CYAN}Running tests${NC}"
yarn test
check_status
echo -e "${GREEN}✓ Web3.js tests completed${NC}"

echo -e "${BLUE}=== All tests completed successfully! ===${NC}"

