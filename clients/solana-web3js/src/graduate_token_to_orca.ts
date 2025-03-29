import { Token } from "./../../solana-kit/node_modules/@solana-program/token-2022/dist/types/generated/accounts/token.d";
import { initializeAccount2InstructionData } from "./../node_modules/@solana/spl-token/src/instructions/initializeAccount2";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  buildDefaultAccountFetcher,
  increaseLiquidityQuoteByInputToken,
  increaseLiquidityQuoteByInputTokenWithParams,
  IncreaseLiquidityQuoteParam,
  PDAUtil,
  PoolUtil,
  PriceMath,
  SPLASH_POOL_TICK_SPACING,
  TickArrayUtil,
  TickUtil,
  TokenExtensionContextForPool,
  TokenExtensionUtil,
  WhirlpoolAccountFetcherInterface,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  METADATA_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-sdk";
import { AddressUtil, Percentage } from "@orca-so/common-sdk";
import assert from "assert";
import Decimal from "decimal.js";
import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

export async function createGraduateTokenToOrcaTransaction(
  connection: Connection,
  whirlpoolsConfigAddress: PublicKey,
  funder: Keypair,
  tokenMaxA: BN,
  tokenMaxB: BN,
  tokenMintAddressA: PublicKey,
  tokenMintAddressB: PublicKey
): Promise<{
  tx: Transaction;
  whirlpoolAddress: PublicKey;
  positionMintAddress: PublicKey;
}> {
  const fetcher = buildDefaultAccountFetcher(connection);

  const [orderedTokenMintAddressA, orderedTokenMintAddressB] =
    PoolUtil.orderMints(tokenMintAddressA, tokenMintAddressB);

  const [mintA, mintB] = await fetcher.getMintInfos([
    orderedTokenMintAddressA,
    orderedTokenMintAddressB,
  ]);

  assert.ok(mintA[1], `${mintA[0]} is not a valid mint`);
  assert.ok(mintB[1], `${mintB[0]} is not a valid mint`);
  const mintInfoA = mintA[1];
  const mintInfoB = mintB[1];

  const initialPrice = new Decimal(
    tokenMaxB
      .mul(new BN(10).pow(new BN(mintInfoA.decimals)))
      .div(tokenMaxA.mul(new BN(10).pow(new BN(mintInfoB.decimals))))
      .toString()
  );
  const initialSqrtPrice = PriceMath.priceToSqrtPriceX64(
    initialPrice,
    mintInfoA.decimals,
    mintInfoB.decimals
  );
  const initialTickIndex = PriceMath.priceToTickIndex(
    initialPrice,
    mintInfoA.decimals,
    mintInfoB.decimals
  );

  const tickSpacing = SPLASH_POOL_TICK_SPACING;
  const [tickLowerIndex, tickUpperIndex] =
    TickUtil.getFullRangeTickIndex(tickSpacing);
  const startTickIndexLower = TickUtil.getStartTickIndex(
    tickLowerIndex,
    tickSpacing
  );
  const startTickIndexUpper = TickUtil.getStartTickIndex(
    tickUpperIndex,
    tickSpacing
  );

  const withTokenMetadataExtension = true;
  const liquidityAmountQuote = increaseLiquidityQuoteByInputTokenWithParams({
    inputTokenAmount: new Decimal(tokenMaxA.toString()),
    inputTokenMint: mintInfoA.address,
    tokenMintA: mintInfoA.address,
    tokenMintB: mintInfoB.address,
    tickCurrentIndex: initialTickIndex,
    sqrtPrice: initialSqrtPrice,
    tickLowerIndex,
    tickUpperIndex,
    tokenExtensionCtx: {
      currentEpoch: await fetcher.getEpoch(),
      tokenMintWithProgramA: mintInfoA,
      tokenMintWithProgramB: mintInfoB,
    },
    slippageTolerance: new Percentage(new BN(0), new BN(100)),
  });

  const whirlpoolAddress = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress, // this should be set by the testing framework
    mintInfoA.address,
    mintInfoB.address,
    tickSpacing
  ).publicKey;
  const feeTie = PDAUtil.getFeeTier(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    tickSpacing
  ).publicKey;
  const tokenBadgeA = PDAUtil.getTokenBadge(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    mintInfoA.address
  ).publicKey;
  const tokenBadgeB = PDAUtil.getTokenBadge(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    mintInfoB.address
  ).publicKey;
  const tokenVaultA = Keypair.generate();
  const tokenVaultB = Keypair.generate();

  const tickArrayAddressLower = PDAUtil.getTickArray(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolAddress,
    startTickIndexLower
  ).publicKey;
  const tickArrayAddressUpper = PDAUtil.getTickArray(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolAddress,
    startTickIndexUpper
  ).publicKey;

  const positionMint = Keypair.generate();
  const positionAddress = PDAUtil.getPosition(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionMint.publicKey
  ).publicKey;
  const positionOwner = AddressUtil.findProgramAddress(
    [Buffer.from("position_owner")],
    ORCA_WHIRLPOOL_PROGRAM_ID
  ).publicKey;
  const positionTokenAccount = await getAssociatedTokenAddress(
    positionMint.publicKey,
    positionOwner,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const tokenProgramA = mintInfoA.tokenProgram;
  const tokenProgramB = mintInfoB.tokenProgram;
  const tokenOwnerAccountA = await getAssociatedTokenAddress(
    positionOwner,
    mintInfoA.address,
    true,
    tokenProgramA
  );
  const tokenOwnerAccountB = await getAssociatedTokenAddress(
    positionOwner,
    mintInfoB.address,
    true,
    tokenProgramB
  );

  const lockConfig = PDAUtil.getLockConfig(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionAddress
  ).publicKey;

  return {
    tx: new Transaction(),
    whirlpoolAddress,
    positionMintAddress: positionMint.publicKey,
  };
}
