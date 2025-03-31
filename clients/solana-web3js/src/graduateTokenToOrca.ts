import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  increaseLiquidityQuoteByInputTokenWithParams,
  PDAUtil,
  PoolUtil,
  PriceMath,
  SPLASH_POOL_TICK_SPACING,
  TickUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  MEMO_PROGRAM_ADDRESS,
  WhirlpoolContext,
} from "@orca-so/whirlpools-sdk";
import { AddressUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { METADATA_UPDATE_AUTH } from "./utils/constants";
import { readFileSync } from "fs";
import { version as anchorVersion } from "@coral-xyz/anchor/package.json";

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
  tx: VersionedTransaction;
  whirlpoolAddress: PublicKey;
  positionMintAddress: PublicKey;
}> {
  const provider = new AnchorProvider(connection, new Wallet(funder), {
    commitment: "confirmed",
  });
  const ctx = WhirlpoolContext.from(
    connection,
    new Wallet(funder),
    ORCA_WHIRLPOOL_PROGRAM_ID
  );

  const [orderedTokenMintAddressA, orderedTokenMintAddressB] =
    PoolUtil.orderMints(tokenMintAddressA, tokenMintAddressB);

  const mintA = await ctx.fetcher.getMintInfo(orderedTokenMintAddressA);
  const mintB = await ctx.fetcher.getMintInfo(orderedTokenMintAddressB);

  const initialPrice = new Decimal(
    tokenMaxB
      .mul(new BN(10).pow(new BN(mintA.decimals)))
      .div(tokenMaxA.mul(new BN(10).pow(new BN(mintB.decimals))))
      .toString()
  );
  const initialSqrtPrice = PriceMath.priceToSqrtPriceX64(
    initialPrice,
    mintA.decimals,
    mintB.decimals
  );
  const initialTickIndex = PriceMath.priceToTickIndex(
    initialPrice,
    mintA.decimals,
    mintB.decimals
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
    inputTokenMint: mintA.address,
    tokenMintA: mintA.address,
    tokenMintB: mintB.address,
    tickCurrentIndex: initialTickIndex,
    sqrtPrice: initialSqrtPrice,
    tickLowerIndex,
    tickUpperIndex,
    tokenExtensionCtx: {
      currentEpoch: await ctx.fetcher.getEpoch(),
      tokenMintWithProgramA: mintA,
      tokenMintWithProgramB: mintB,
    },
    slippageTolerance: new Percentage(new BN(0), new BN(100)),
  });

  const whirlpoolAddress = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    mintA.address,
    mintB.address,
    tickSpacing
  ).publicKey;
  const feeTier = PDAUtil.getFeeTier(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    tickSpacing
  ).publicKey;
  const tokenBadgeA = PDAUtil.getTokenBadge(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    mintA.address
  ).publicKey;
  const tokenBadgeB = PDAUtil.getTokenBadge(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    whirlpoolsConfigAddress,
    mintB.address
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
    WHIRLPOOL_CPI_PROGRAM_ID
  ).publicKey;
  const positionTokenAccount = getAssociatedTokenAddressSync(
    positionMint.publicKey,
    positionOwner,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const tokenProgramA = mintA.tokenProgram;
  const tokenProgramB = mintB.tokenProgram;
  const tokenOwnerAccountA = getAssociatedTokenAddressSync(
    mintA.address,
    positionOwner,
    true,
    tokenProgramA
  );
  const tokenOwnerAccountB = getAssociatedTokenAddressSync(
    mintB.address,
    positionOwner,
    true,
    tokenProgramB
  );

  const lockConfig = PDAUtil.getLockConfig(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    positionAddress
  ).publicKey;

  // Use the helper function to create the program instance since we need to handle different Anchor versions
  const program = createProgram(idl, provider, WHIRLPOOL_CPI_PROGRAM_ID);

  const ix = await program.methods
    .graduateTokenToOrca(
      tickSpacing,
      initialSqrtPrice,
      startTickIndexLower,
      startTickIndexUpper,
      tickLowerIndex,
      tickUpperIndex,
      withTokenMetadataExtension,
      liquidityAmountQuote.liquidityAmount,
      tokenMaxA,
      tokenMaxB
    )
    .accounts({
      whirlpoolProgram: ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolsConfig: whirlpoolsConfigAddress,
      whirlpool: whirlpoolAddress,
      tokenMintA: mintA.address,
      tokenMintB: mintB.address,
      tokenBadgeA: tokenBadgeA,
      tokenBadgeB: tokenBadgeB,
      funder: funder.publicKey,
      tokenVaultA: tokenVaultA.publicKey,
      tokenVaultB: tokenVaultB.publicKey,
      feeTier: feeTier,
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
    .instruction();
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const messageV0 = new TransactionMessage({
    payerKey: funder.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [computeBudgetIx, ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  tx.sign([funder, tokenVaultA, tokenVaultB, positionMint]);

  return {
    tx,
    whirlpoolAddress,
    positionMintAddress: positionMint.publicKey,
  };
}

// Helper function to create a Program instance based on Anchor version
function createProgram(
  idl: any,
  provider: AnchorProvider,
  programId?: PublicKey
): any {
  // Use Function constructor to bypass TypeScript type checking
  // This allows us to handle different Anchor versions at runtime
  if (anchorVersion.startsWith("0.29")) {
    // For Anchor v0.29.x, we need the program ID
    return new Function(
      "Program",
      "idl",
      "programId",
      "provider",
      "return new Program(idl, programId, provider);"
    )(Program, idl, programId, provider);
  } else {
    // For Anchor v0.30.x and later, we don't need the program ID
    return new Function(
      "Program",
      "idl",
      "provider",
      "return new Program(idl, provider);"
    )(Program, idl, provider);
  }
}
