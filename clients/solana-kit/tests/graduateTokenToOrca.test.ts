import { describe, it } from "vitest";
import { createGraduateTokenToOrcaInstruction } from "../src/graduateTokenToOrca";
import { rpc, sendTransaction, signer } from "./utils/mockRpc";
import { WHIRLPOOL_CPI_PROGRAM_ADDRESS } from "../codama/generated";
import {
  Address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { setupAta, setupMint } from "./utils/token";
import { WHIRLPOOLS_CONFIG_ADDRESS } from "@orca-so/whirlpools";
import {
  fetchLockConfig,
  fetchWhirlpool,
  getPositionAddress,
  LockType,
  WHIRLPOOL_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-client";
import { fetchToken } from "@solana-program/token-2022";
import { priceToSqrtPrice } from "@orca-so/whirlpools-core";
import assert from "assert";
import Decimal from "decimal.js";
import { setupAta2022, setupMint2022 } from "./utils/token2022";
import { orderMints } from "../src/utils/token";

describe("Launchpad CPI", () => {
  it("Should graduate Tokenkeg tokens to orca with token remainders", async () => {
    // Setup test values
    const decimals0: number = 9;
    const decimals1: number = 6;
    const tokenMax0: bigint = 138000000000n;
    const tokenMax1: bigint = 1000000000000000001n;

    // Setup position owner address
    const positionOwner = (
      await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_CPI_PROGRAM_ADDRESS,
        seeds: ["position_owner"],
      })
    )[0];

    // Setup mints and ATAs
    const mint0 = await setupMint({ decimals: decimals0 });
    const mint1 = await setupMint2022({ decimals: decimals1 });
    const ata0 = await setupAta(mint0, {
      amount: tokenMax0,
      owner: positionOwner,
    });
    const ata1 = await setupAta2022(mint1, {
      amount: tokenMax1,
      owner: positionOwner,
    });

    // Create graduate token instruction
    const { ix, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
      await createGraduateTokenToOrcaInstruction(
        rpc,
        WHIRLPOOLS_CONFIG_ADDRESS,
        signer,
        tokenMax0,
        tokenMax1,
        mint0,
        mint1
      );
    await sendTransaction([ix]);

    // THE FOLLOWINGPART IS ONLY NEEDED TO ASSERT THE RESULTS
    // Determine token ordering - 
    const [mintA, mintB] = orderMints(mint0, mint1);
    const isReordered = mintA !== mint0;
    let tokenMaxA: bigint;
    let tokenMaxB: bigint;
    let decimalsA: number;
    let decimalsB: number;
    let ataA: Address;
    let ataB: Address;
    if (isReordered) {
      tokenMaxA = tokenMax1;
      tokenMaxB = tokenMax0;
      decimalsA = decimals1;
      decimalsB = decimals0;
      ataA = ata1;
      ataB = ata0;
    } else {
      tokenMaxA = tokenMax0;
      tokenMaxB = tokenMax1;
      decimalsA = decimals0;
      decimalsB = decimals1;
      ataA = ata0;
      ataB = ata1;
    }

    // Calculate expected price
    const price = new Decimal(tokenMaxB.toString())
      .mul(new Decimal(10).pow(decimalsA))
      .div(new Decimal(tokenMaxA.toString()).mul(new Decimal(10).pow(decimalsB)));
    const sqrtPrice = priceToSqrtPrice(
      price.toNumber(),
      decimalsA,
      decimalsB
    );

    // Fetch pool data
    const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddress);
    const tokenVaultA = whirlpool.data.tokenVaultA;
    const tokenVaultB = whirlpool.data.tokenVaultB;
    const positionAddress = (await getPositionAddress(positionMintAddress))[0];
    const lockConfig = (
      await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
        seeds: ["lock_config", getAddressEncoder().encode(positionAddress)],
      })
    )[0];

    // Get token balances
    const balanceAtaA = (await fetchToken(rpc, ataA)).data.amount;
    const balanceAtaB = (await fetchToken(rpc, ataB)).data.amount;
    const balanceTokenVaultA = (await fetchToken(rpc, tokenVaultA)).data.amount;
    const balanceTokenVaultB = (await fetchToken(rpc, tokenVaultB)).data.amount;
    const lockType = (await fetchLockConfig(rpc, lockConfig)).data.lockType;

    // Allow for small differences due to rounding
    const maxDiffPercentage = 0.005;

    const tokenVaultADiff = balanceTokenVaultA > tokenMaxA
      ? balanceTokenVaultA - tokenMaxA
      : tokenMaxA - balanceTokenVaultA;
    const tokenVaultBDiff = balanceTokenVaultB > tokenMaxB
      ? balanceTokenVaultB - tokenMaxB
      : tokenMaxB - balanceTokenVaultB;

    const tokenVaultADiffPercentage = Number(tokenVaultADiff) / Number(tokenMaxA);
    const tokenVaultBDiffPercentage = Number(tokenVaultBDiff) / Number(tokenMaxB);

    // Assertions
    assert.strictEqual(whirlpool.data.sqrtPrice, sqrtPrice);
    assert.ok(tokenVaultADiffPercentage <= maxDiffPercentage);
    assert.ok(tokenVaultBDiffPercentage <= maxDiffPercentage);
    assert.strictEqual(balanceAtaA, tokenVaultADiff);
    assert.strictEqual(balanceAtaB, tokenVaultBDiff);
    assert.strictEqual(lockType, LockType.Permanent);
  });
});
