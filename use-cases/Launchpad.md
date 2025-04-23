# Launchpad Integration Guide 🚀

This guide explains how to integrate Orca's Splash Pools with your Launchpad's bonding curve for a seamless token graduation process. Many launchpad creators traditionally integrate with DEXes that use Constant Product Market Makers (CPMMs) due to their perceived simplicity. However, Orca's Splash Pools, built on Concentrated Liquidity Market Maker (CLMM) architecture, offer superior capital efficiency while maintaining simplicity.

## Understanding Splash Pools 💦

Splash Pools are a unique type of liquidity pool built on Orca's CLMM infrastructure. They are specially designed for:

- Community-driven projects (including memecoins)
- Projects seeking easy liquidity deployment
- Token creators who want to establish pools with minimal ongoing management

Unlike standard CLMMs, Splash Pools:

- Only support full-range positions (eliminating the need for complex tick array management)
- Are faster, simpler, and more cost-effective to create
- Use the same underlying program as Orca's other pools (ensuring compatibility with all current integrations)

### How Splash Pools Differ from CPMMs

While both provide liquidity for token pairs, there are key differences:

- In Splash Pools, liquidity providers receive a position NFT representing their specific position (not fungible LP tokens)
- Yields must be manually harvested (not automatically compounded)
- The underlying CLMM architecture offers greater capital efficiency

### Position NFT Ownership and Fee Collection 💎

One key advantage of this implementation is that **even after liquidity is locked, trading fees can still be collected**. The position NFT, which represents ownership of the liquidity position, is owned by a Program Derived Address (PDA) of your launchpad program.

As the launchpad creator, you can decide what to do with this NFT:

- Keep it to collect trading fees on behalf of your platform
- Transfer it to the token creators so they can collect the fees
- Use it in other creative ways within your ecosystem

This provides flexibility while ensuring the base liquidity remains permanently available to traders.

## Technical Implementation 🛠️

Graduating a token from a bonding curve to a Splash Pool requires several steps. The process involves initializing a pool, creating tick arrays, opening a position, adding liquidity, and locking the position.

### Required Instructions

The following instructions must be executed to graduate a token to Orca:

1. **Initialize Pool**: Creates the pool with the specified token pair and initial price
2. **Initialize Tick Arrays**: Sets up the tick arrays for the full range position
3. **Open Position**: Creates a position NFT representing liquidity in the pool, owned by your launchpad program's PDA
4. **Increase Liquidity**: Adds tokens from your bonding curve to the pool
5. **Lock Position**: Permanently locks the position to ensure liquidity remains, while still allowing fee collection

### Price Considerations

The CLMM architecture tracks prices based on liquidity distribution. The initial price must be set when initializing the pool, calculated from the token amounts in your bonding curve:

```
initialPrice = (tokenMaxB * 10^decimalsA) / (tokenMaxA * 10^decimalsB)
```

## Client Implementations

We provide two client implementations for your launchpad's frontend to interact with your on-chain launchpad program. These clients handle the complexity of the token graduation process while your launchpad program performs the actual Cross-Program Invocation (CPI) to the Whirlpools program:

### @solana/kit Implementation

The `@solana/kit` client provides a modern approach for your launchpad frontend to communicate with your launchpad program.

```typescript
import { createGraduateTokenToOrcaInstruction } from "../src/graduateTokenToOrca";

// Sample usage in your launchpad's frontend
const { ix, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
  await createGraduateTokenToOrcaInstruction(
    rpc,
    WHIRLPOOLS_CONFIG_ADDRESS,
    funder, // The account that will pay for transactions
    tokenAmount0, // Amount of first token from your bonding curve
    tokenAmount1, // Amount of second token from your bonding curve
    tokenMintAddress0, // First token mint address
    tokenMintAddress1 // Second token mint address
  );

// Send the transaction to your launchpad program
await sendTransaction([ix]);
```

The client prepares everything your launchpad program needs to execute the CPI call:

- Correct ordering of token mints
- Calculation of initial price from token amounts
- Creation of all necessary PDAs and accounts
- Setting up full range position boundaries
- Locking liquidity to ensure permanent availability
- Managing the position NFT ownership by your launchpad program's PDA

### @solana/web3.js Implementation

The traditional web3.js implementation offers compatibility with existing Anchor-based systems for your launchpad frontend.

```typescript
import { createGraduateTokenToOrcaTransaction } from "../src/graduateTokenToOrca";

// Sample usage in your launchpad's frontend
const { tx, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
  await createGraduateTokenToOrcaTransaction(
    connection,
    whirlpoolsConfigAddress,
    funder, // Keypair that will sign and pay for the transaction
    tokenAmount0, // BN amount of first token from your bonding curve
    tokenAmount1, // BN amount of second token from your bonding curve
    tokenMintAddress0, // First token mint address
    tokenMintAddress1 // Second token mint address
  );

// Send the transaction to your launchpad program
await connection.sendTransaction(tx);
```

## Important: Token Mint Ordering

In Whirlpools, token mints must be ordered canonically to maintain consistency. If you provide tokens in non-canonical order, the Whirlpools program will return an error. That's why our client implementations automatically handle mint ordering before interacting with your launchpad program.

This automatic ordering may result in your expected token A and token B positions being swapped in the on-chain representation. However, there's no need to worry about this, as the client code automatically adjusts the price calculation to account for this potential swap.

For example, if your tokens get swapped during ordering, the price will still be correctly calculated as TokenB/TokenA (price of token A in terms of token B). Additionally, when your pool is displayed in the Orca UI, it will always show tokens like SOL and USDC as quote tokens regardless of their on-chain ordering, ensuring users see the price in a familiar format.

### Kit Client Example

```typescript
// From clients/solana-kit/src/utils/token.ts
export function orderMints(mint1: Address, mint2: Address): [Address, Address] {
  const encoder = getAddressEncoder();
  const mint1Bytes = new Uint8Array(encoder.encode(mint1));
  const mint2Bytes = new Uint8Array(encoder.encode(mint2));
  return Buffer.compare(mint1Bytes, mint2Bytes) < 0
    ? [mint1, mint2]
    : [mint2, mint1];
}

// Usage in graduateTokenToOrca.ts
const [tokenMintAddressA, tokenMintAddressB] = orderMints(
  tokenMintAddress0,
  tokenMintAddress1
);
```

### Web3.js Client Example

```typescript
// Usage in graduateTokenToOrca.ts
const [orderedTokenMintAddressA, orderedTokenMintAddressB] =
  PoolUtil.orderMints(tokenMintAddress0, tokenMintAddress1);
```

Our client implementations handle all aspects of this process, including the price calculation based on the amounts in your bonding curve (adjusted for any token reordering that may occur):

```typescript
// Original inputs are tokenAmount0 and tokenAmount1
// After ordering, we map them to tokenAmountA and tokenAmountB based on canonical ordering
const isReordered = tokenMintAddressA !== tokenMintAddress0;
const tokenAmountA = isReordered ? tokenAmount1 : tokenAmount0;
const tokenAmountB = isReordered ? tokenAmount0 : tokenAmount1;

// Then calculate price using the ordered values
const initialPrice = new Decimal(tokenAmountB.toString())
  .mul(new Decimal(10).pow(decimalsA))
  .div(
    new Decimal(tokenAmountA.toString()).mul(new Decimal(10).pow(decimalsB))
  );
```

## Important: Understanding Token Leftovers in Your Bonding Curve Vaults

When graduating tokens to an Orca Splash Pool, you may notice that some tokens remain in your bonding curve vaults. This is normal with CLMMs and happens because the protocol calculates the mathematically optimal token amounts needed for your liquidity position.

For example, if you're providing 138 tokens with 9 decimal places, you might find that 0.000192373 tokens remain in your original vault. These leftovers can vary based on your token's decimals and quantities.

As a launchpad creator, plan for these leftovers in your implementation and include logic to handle the remaining tokens appropriately (return to users or keep in treasury).

## Complete Integration Process

1. Implement the launchpad program using the provided Anchor program example
2. Import the appropriate client for your launchpad's frontend (`@solana/kit` or `@solana/web3.js`)
3. Determine the amount of tokens in your bonding curve vaults
4. Call the graduation function with these amounts from your frontend
5. Your launchpad program will execute the CPI to the Whirlpools program
6. Your token is now available on Orca with initial liquidity
7. Decide how to handle the position NFT that is owned by your launchpad program's PDA:
   - Keep it to collect trading fees for your platform
   - Transfer it to token creators
   - Use it in other ways within your ecosystem

The beauty of this implementation is that you only need to provide the token amounts from your bonding curve vaults to your launchpad program - the client code and launchpad program handle all the complexity of tick arrays, position creation, and price calculation for you.

By leveraging Orca's Splash Pools, your project gains access to Orca's ecosystem and the benefits of concentrated liquidity without sacrificing simplicity, while maintaining the ability to collect trading fees through the position NFT.
