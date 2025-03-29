import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { BN, Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  buildDefaultAccountFetcher,
  increaseLiquidityQuoteByInputTokenWithParams,
  PDAUtil,
  PoolUtil,
  PriceMath,
  SPLASH_POOL_TICK_SPACING,
  TickUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  MEMO_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-sdk";
import { AddressUtil, Percentage } from "@orca-so/common-sdk";
import assert from "assert";
import Decimal from "decimal.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { METADATA_UPDATE_AUTH } from "./utils/constants";
import { readFileSync } from "fs";

// Define a constant for the program ID
const WHIRLPOOL_CPI_PROGRAM_ID = new PublicKey(
  "23WKGEsTRVZiVuwg8eyXByPq2xkzTR8v6TW4V1WiT89g"
);
const idl = JSON.parse(
  readFileSync("../../anchor-program/target/idl/whirlpool_cpi.json", "utf8")
);

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
    inputTokenAmount: tokenMaxA,
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

  // Create a mock provider for Anchor
  const provider = new AnchorProvider(connection, new Wallet(funder), {
    commitment: "confirmed",
  });

  const program = new Program(idl, WHIRLPOOL_CPI_PROGRAM_ID, provider);

  // Create a new transaction
  const tx = new Transaction();

  // Add the graduateTokenToOrca instruction to the transaction
  const instruction = await program.methods
    .graduateTokenToOrca(
      tickSpacing,
      new BN(initialSqrtPrice.toString()),
      startTickIndexLower,
      startTickIndexUpper,
      tickLowerIndex,
      tickUpperIndex,
      withTokenMetadataExtension,
      new BN(liquidityAmountQuote.liquidityAmount.toString()),
      new BN(tokenMaxA.toString()),
      new BN(tokenMaxB.toString())
    )
    .accounts({
      whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolsConfig: whirlpoolsConfigAddress,
      whirlpool: whirlpoolAddress,
      tokenMintA: mintInfoA.address,
      tokenMintB: mintInfoB.address,
      tokenBadgeA: tokenBadgeA,
      tokenBadgeB: tokenBadgeB,
      funder: funder.publicKey,
      tokenVaultA: tokenVaultA.publicKey,
      tokenVaultB: tokenVaultB.publicKey,
      feeTier: feeTie,
      tickArrayLower: tickArrayAddressLower,
      tickArrayUpper: tickArrayAddressUpper,
      positionOwner: positionOwner,
      position: positionAddress,
      positionMint: positionMint.publicKey,
      positionTokenAccount: positionTokenAccount,
      tokenOwnerAccountA: tokenOwnerAccountA,
      tokenOwnerAccountB: tokenOwnerAccountB,
      tokenProgramA: tokenProgramA,
      tokenProgramB: tokenProgramB,
      lockConfig: lockConfig,
      token2022Program: TOKEN_2022_PROGRAM_ID,
      metadataUpdateAuth: METADATA_UPDATE_AUTH,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ADDRESS,
    })
    .signers([funder, tokenVaultA, tokenVaultB, positionMint])
    .instruction();

  tx.add(instruction);

  return {
    tx,
    whirlpoolAddress,
    positionMintAddress: positionMint.publicKey,
  };
}
