import {
  Address,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  KeyPairSigner,
  Rpc,
  SolanaRpcApi,
} from "@solana/kit";
import {
  getFeeTierAddress,
  getPositionAddress,
  getTickArrayAddress,
  getTokenBadgeAddress,
  getWhirlpoolAddress,
  WHIRLPOOL_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-client";
import {
  priceToSqrtPrice,
  getTickArrayStartTickIndex,
  increaseLiquidityQuoteA,
  getFullRangeTickIndexes,
  increaseLiquidityQuoteB,
} from "@orca-so/whirlpools-core";
import { orderMints } from "@orca-so/whirlpools"
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  fetchMint,
  findAssociatedTokenPda,
} from "@solana-program/token-2022";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";
import { SYSVAR_RENT_ADDRESS } from "@solana/sysvars";
import {
  METADATA_UPDATE_AUTH,
  SPLASH_POOL_TICK_SPACING,
} from "./utils/constants";
import {
  getGraduateTokenToOrcaInstruction,
  GraduateTokenToOrcaInstruction,
  WHIRLPOOL_CPI_PROGRAM_ADDRESS,
} from "../codama/generated";
import { Decimal } from "decimal.js";

export async function createGraduateTokenToOrcaInstruction(
  rpc: Rpc<SolanaRpcApi>,
  whirlpoolsConfigAddress: Address,
  funder: KeyPairSigner,
  tokenAmount0: bigint,
  tokenAmount1: bigint,
  tokenMintAddress0: Address,
  tokenMintAddress1: Address
): Promise<{
  ix: GraduateTokenToOrcaInstruction;
  whirlpoolAddress: Address;
  positionMintAddress: Address;
  tokenMintA: Address;
  tokenMintB: Address;
}> {
  const [tokenMintAddressA, tokenMintAddressB] = orderMints(
    tokenMintAddress0,
    tokenMintAddress1
  );

  const isReordered = tokenMintAddressA !== tokenMintAddress0;
  const tokenAmountA = isReordered ? tokenAmount1 : tokenAmount0;
  const tokenAmountB = isReordered ? tokenAmount0 : tokenAmount1;

  const tokenMintA = await fetchMint(rpc, tokenMintAddressA);
  const tokenMintB = await fetchMint(rpc, tokenMintAddressB);
  const decimalsA = tokenMintA.data.decimals;
  const decimalsB = tokenMintB.data.decimals;

  const initialPrice = new Decimal(tokenAmountB.toString())
    .mul(new Decimal(10).pow(decimalsA))
    .div(new Decimal(tokenAmountA.toString()).mul(new Decimal(10).pow(decimalsB)));

  const initialSqrtPrice = priceToSqrtPrice(initialPrice.toNumber(), decimalsA, decimalsB);

  const tickSpacing = SPLASH_POOL_TICK_SPACING;
  const { tickLowerIndex, tickUpperIndex } =
    getFullRangeTickIndexes(tickSpacing);
  const startTickIndexLower = getTickArrayStartTickIndex(
    tickLowerIndex,
    tickSpacing
  );
  const startTickIndexUpper = getTickArrayStartTickIndex(
    tickUpperIndex,
    tickSpacing
  );
  const withTokenMetadataExtension = true;
  const liquidityAmountQuoteA = increaseLiquidityQuoteA(
    BigInt(tokenAmountA.toString()),
    0,
    initialSqrtPrice,
    tickLowerIndex,
    tickUpperIndex
  );
  const liquidityAmountQuoteB = increaseLiquidityQuoteB(
    BigInt(tokenAmountB.toString()),
    0,
    initialSqrtPrice,
    tickLowerIndex,
    tickUpperIndex
  );
  const liquidityDelta = liquidityAmountQuoteA.liquidityDelta < liquidityAmountQuoteB.liquidityDelta
    ? liquidityAmountQuoteA.liquidityDelta
    : liquidityAmountQuoteB.liquidityDelta;

  const [
    whirlpoolAddress,
    feeTier,
    tokenBadgeA,
    tokenBadgeB,
    tokenVaultA,
    tokenVaultB,
  ] = await Promise.all([
    getWhirlpoolAddress(
      whirlpoolsConfigAddress,
      tokenMintA.address,
      tokenMintB.address,
      tickSpacing
    ).then((x) => x[0]),
    getFeeTierAddress(whirlpoolsConfigAddress, tickSpacing).then((x) => x[0]),
    getTokenBadgeAddress(whirlpoolsConfigAddress, tokenMintA.address).then(
      (x) => x[0]
    ),
    getTokenBadgeAddress(whirlpoolsConfigAddress, tokenMintB.address).then(
      (x) => x[0]
    ),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  const tickArrayAddressLower = (
    await getTickArrayAddress(whirlpoolAddress, startTickIndexLower)
  )[0];
  const tickArrayAddressUpper = (
    await getTickArrayAddress(whirlpoolAddress, startTickIndexUpper)
  )[0];

  const positionMint = await generateKeyPairSigner();
  const positionAddress = (await getPositionAddress(positionMint.address))[0];
  const positionOwner = (
    await getProgramDerivedAddress({
      programAddress: WHIRLPOOL_CPI_PROGRAM_ADDRESS,
      seeds: ["position_owner"],
    })
  )[0];
  const positionTokenAccount = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: positionMint.address,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    })
  )[0];

  const tokenProgramA = tokenMintA.programAddress;
  const tokenProgramB = tokenMintB.programAddress;
  const tokenOwnerAccountA = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: tokenMintAddressA,
      tokenProgram: tokenProgramA,
    })
  )[0];

  const tokenOwnerAccountB = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: tokenMintAddressB,
      tokenProgram: tokenProgramB,
    })
  )[0];

  const lockConfig = (
    await getProgramDerivedAddress({
      programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
      seeds: ["lock_config", getAddressEncoder().encode(positionAddress)],
    })
  )[0];

  const ix = getGraduateTokenToOrcaInstruction({
    whirlpoolProgram: WHIRLPOOL_PROGRAM_ADDRESS,
    whirlpoolsConfig: whirlpoolsConfigAddress,
    whirlpool: whirlpoolAddress,
    tokenMintA: tokenMintAddressA,
    tokenMintB: tokenMintAddressB,
    tokenBadgeA,
    tokenBadgeB,
    funder: funder,
    tokenVaultA: tokenVaultA,
    tokenVaultB: tokenVaultB,
    feeTier,
    tickArrayLower: tickArrayAddressLower,
    tickArrayUpper: tickArrayAddressUpper,
    positionOwner,
    position: positionAddress,
    positionMint,
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tokenProgramA,
    tokenProgramB,
    lockConfig,
    token2022Program: TOKEN_2022_PROGRAM_ADDRESS,
    metadataUpdateAuth: METADATA_UPDATE_AUTH,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    memoProgram: MEMO_PROGRAM_ADDRESS,
    tickSpacing,
    initialSqrtPrice,
    startTickIndexLower,
    startTickIndexUpper,
    tickLowerIndex,
    tickUpperIndex,
    withTokenMetadataExtension,
    liquidityAmount: liquidityDelta,
  });

  return {
    ix,
    whirlpoolAddress,
    positionMintAddress: positionMint.address,
    tokenMintA: tokenMintAddressA,
    tokenMintB: tokenMintAddressB
  };
}
