import anchor, { BN, Program } from "@coral-xyz/anchor";
import { address, Address, generateKeyPairSigner, getAddressEncoder, getProgramDerivedAddress, KeyPairSigner, Rpc, SolanaRpcApi } from "@solana/kit";
import { getFeeTierAddress, getPositionAddress, getTickArrayAddress, getTokenBadgeAddress, getWhirlpoolAddress, WHIRLPOOL_PROGRAM_ADDRESS } from "@orca-so/whirlpools-client";
import { WhirlpoolCpi } from "../target/types/whirlpool_cpi";
import { priceToTickIndex, getInitializableTickIndex, priceToSqrtPrice, getTickArrayStartTickIndex, increaseLiquidityQuoteA } from "@orca-so/whirlpools-core";
import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, Mint, TOKEN_2022_PROGRAM_ADDRESS, fetchMint, findAssociatedTokenPda } from "@solana-program/token-2022";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";

const ORCA_WHIRLPOOLS_CONFIG_ADDRESS = address("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ")

export async function graduateTokenToOrca( 
    rpc: Rpc<SolanaRpcApi>,
    amountTokenA: BN,
    amountTokenB: BN,
    funder: KeyPairSigner,
    launchPadProgramId: Address,
    tokenMintAddressA: Address,
    tokenMintAddressB: Address,
) {
    const program = anchor.workspace.WhirlpoolCpi as Program<WhirlpoolCpi>;
    const programId = address(program.programId.toString());

    const [orderedTokenMintAddressA, orderedTokenMintAddressB] = orderMints(tokenMintAddressA, tokenMintAddressB);

    const tokenMintA = await fetchMint(rpc, orderedTokenMintAddressA);
    const tokenMintB = await fetchMint(rpc, orderedTokenMintAddressB);
    const decimalsA = tokenMintA.data.decimals;
    const decimalsB = tokenMintB.data.decimals;

    // Calculate price of tokenA in terms of tokenB, accounting for decimals
    const initialPrice = Number(amountTokenB.mul(new BN(10).pow(new BN(decimalsA))).div(amountTokenA.mul(new BN(10).pow(new BN(decimalsB)))));
    const initialSqrtPrice = priceToSqrtPrice(initialPrice, decimalsA, decimalsB);
    
    const tickSpacing = 32896;
    const tickLowerIndex = -427648;
    const tickUpperIndex = 427648;
    const startTickIndexLower = getTickArrayStartTickIndex(tickLowerIndex, tickSpacing);
    const startTickIndexUpper = getTickArrayStartTickIndex(tickUpperIndex, tickSpacing);
    const withTokenMetadataExtension = true;
    const liquidityAmountQuote = increaseLiquidityQuoteA(
        BigInt(amountTokenA.toString()),
        0,
        initialSqrtPrice,
        tickLowerIndex,
        tickUpperIndex,
    );

    const [
        whirlpoolAddress,
        feeTier,
        tokenBadgeA,
        tokenBadgeB,
        tokenVaultA,
        tokenVaultB,
    ] = await Promise.all([
        getWhirlpoolAddress(
            ORCA_WHIRLPOOLS_CONFIG_ADDRESS,
            tokenMintA,
            tokenMintB,
            tickSpacing,
        ).then((x) => x[0]),
        getFeeTierAddress(ORCA_WHIRLPOOLS_CONFIG_ADDRESS, tickSpacing).then((x) => x[0]),
        getTokenBadgeAddress(ORCA_WHIRLPOOLS_CONFIG_ADDRESS, tokenMintA).then(
            (x) => x[0],
        ),
        getTokenBadgeAddress(ORCA_WHIRLPOOLS_CONFIG_ADDRESS, tokenMintB).then(
            (x) => x[0],
        ),
        generateKeyPairSigner(),
        generateKeyPairSigner(),
    ]);

    const tickArrayAddressLower = (await getTickArrayAddress(whirlpoolAddress, startTickIndexLower))[0];
    const tickArrayAddressUpper = (await getTickArrayAddress(whirlpoolAddress, startTickIndexUpper))[0];

    const positionMint = await generateKeyPairSigner();
    const positionAddress = await getPositionAddress(positionMint.address);
    const positionTokenAccount = (await findAssociatedTokenPda({
        owner: funder.address,
        mint: positionMint.address,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    }))[0];

    const tokenProgramA = tokenMintA.programAddress
    const tokenProgramB = tokenMintB.programAddress
    const tokenOwnerAccountA = (await findAssociatedTokenPda({
        owner: launchPadProgramId,
        mint: orderedTokenMintAddressA,
        tokenProgram: tokenProgramA,
    }))[0];

    const tokenOwnerAccountB = (await findAssociatedTokenPda({
        owner: launchPadProgramId,
        mint: orderedTokenMintAddressB,
        tokenProgram: tokenProgramB,
    }))[0];

    const metadataUpdateAuth = address("3axbTs2z5GBy6usVbNVoqEgZMng3vZvMnAoX29BFfwhr");

    const lockConfig = (await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
        seeds: ["position", getAddressEncoder().encode(positionMint.address)],
      }))[0];

    const ix = program.methods.graduateTokenToOrca(
        tickSpacing,
        new BN(initialSqrtPrice.toString()),
        startTickIndexLower,
        startTickIndexUpper,
        tickLowerIndex,
        tickUpperIndex,
        withTokenMetadataExtension,
        new BN(liquidityAmountQuote.liquidityDelta.toString()),
        amountTokenA,
        amountTokenB,
    ).accounts({
        whirlpoolProgram: whirlpoolAddress,
        whirlpoolsConfig: ORCA_WHIRLPOOLS_CONFIG_ADDRESS,
        whirlpool: whirlpoolAddress,
        tokenMintA: orderedTokenMintAddressA,
        tokenMintB: orderedTokenMintAddressB,
        tokenBadgeA,
        tokenBadgeB,
        funder: funder.address,
        tokenVaultA,
        tokenVaultB,
        feeTier,
        tickArrayLower: tickArrayAddressLower,
        tickArrayUpper: tickArrayAddressUpper,
        positionOwner: launchPadProgramId,
        position: positionAddress,
        positionMint: positionMint.address,
        positionTokenAccount,
        tokenOwnerAccountA,
        tokenOwnerAccountB,
        tokenProgramA,
        tokenProgramB,
        lockConfig,
        metadataUpdateAuth,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,
        rent: address("SysvarRent111111111111111111111111111111111"),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
        memoProgram: MEMO_PROGRAM_ADDRESS,
    })
}

function orderMints(mint1: Address, mint2: Address): [Address, Address] {
    const encoder = getAddressEncoder();
    const mint1Bytes = new Uint8Array(encoder.encode(mint1));
    const mint2Bytes = new Uint8Array(encoder.encode(mint2));
    return Buffer.compare(mint1Bytes, mint2Bytes) < 0
      ? [mint1, mint2]
      : [mint2, mint1];
  }
