cd anchor-program
# Line below should be commented out when using Anchor 0.31.0
cargo update solana-program@2.2.1 --precise 1.18.17
anchor build
cd ../clients/solana-kit
yarn install
cp ../../anchor-program/target/deploy/whirlpool_cpi.so tests/fixtures/
node codama/codama.js
yarn test

