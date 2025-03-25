import { beforeAll, describe, it } from "vitest";
import { createGraduateTokenToOrcaInstruction } from "../client/graduate_token_to_orca";
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

describe("Launchpad CPI", () => {
  let whirlpoolCpiProgramAddress: Address;
  let positionOwner: Address;
  let mintA: Address;
  let mintB: Address;
  let ataA: Address;
  let ataB: Address;
  let tokenMaxA: bigint = 1000000000000000000n;
  let tokenMaxB: bigint = 1000000000000000000n;

  beforeAll(async () => {
    whirlpoolCpiProgramAddress = WHIRLPOOL_CPI_PROGRAM_ADDRESS;
    positionOwner = (
      await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_CPI_PROGRAM_ADDRESS,
        seeds: ["position_owner"],
      })
    )[0];
    mintA = await setupMint();
    mintB = await setupMint();
    ataA = await setupAta(mintA, {
      amount: tokenMaxA,
      owner: positionOwner,
    });
    ataB = await setupAta(mintB, {
      amount: tokenMaxB,
      owner: positionOwner,
    });
  });

  it("Should graduate token to orca", async () => {
    const { ix, whirlpoolAddress, positionMintAddress } =
      await createGraduateTokenToOrcaInstruction(
        rpc,
        WHIRLPOOLS_CONFIG_ADDRESS,
        signer,
        tokenMaxA,
        tokenMaxB,
        mintA,
        mintB
      );
    await sendTransaction([ix]);

    const price = 1;
    const sqrtPrice = priceToSqrtPrice(price, 6, 6);
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

    const balanceAtaB = (await fetchToken(rpc, ataB)).data.amount;
    const balanceTokenVaultA = (await fetchToken(rpc, tokenVaultA)).data.amount;
    const balanceTokenVaultB = (await fetchToken(rpc, tokenVaultB)).data.amount;
    const balanceAtaA = (await fetchToken(rpc, ataA)).data.amount;
    const lockType = (await fetchLockConfig(rpc, lockConfig)).data.lockType;

    assert.strictEqual(whirlpool.data.sqrtPrice, sqrtPrice);
    assert.strictEqual(balanceTokenVaultA, tokenMaxA);
    assert.strictEqual(balanceTokenVaultB, tokenMaxB);
    assert.strictEqual(balanceAtaA, 0n);
    assert.strictEqual(balanceAtaB, 0n);
    assert.strictEqual(lockType, LockType.Permanent);
  });
});
