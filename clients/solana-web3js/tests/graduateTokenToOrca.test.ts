import { beforeAll, describe, it } from "vitest";
import { LiteSVM, TransactionMetadata } from "litesvm";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import assert from "assert";
import { setupAta, setupMint } from "./utils/token";
import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@orca-so/whirlpools-sdk";
import { AddressUtil } from "@orca-so/common-sdk";
import { createGraduateTokenToOrcaTransaction } from "../src/graduateTokenToOrca";
import {
  connection,
  signer,
  whirlpoolsConfigAddress,
} from "./utils/mockConnection";
import { getMint } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

describe("Launchpad CPI", () => {
  let positionOwner: PublicKey;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let ataA: PublicKey;
  let ataB: PublicKey;
  const tokenMaxA = new BN("1000000000000000000");
  const tokenMaxB = new BN("1000000000000000000");

  beforeAll(async () => {
    positionOwner = AddressUtil.findProgramAddress(
      [Buffer.from("position_owner")],
      ORCA_WHIRLPOOL_PROGRAM_ID
    ).publicKey;
    mintA = await setupMint({ decimals: 6 });
    mintB = await setupMint({ decimals: 6 });
    ataA = await setupAta(mintA, { owner: positionOwner, amount: tokenMaxA });
    ataB = await setupAta(mintB, { owner: positionOwner, amount: tokenMaxB });
  });

  it("Should graduate token to orca", async () => {
    const ataAccountA = await getMint(connection, mintA);
    console.log(whirlpoolsConfigAddress);
    const configAccount = await connection.getAccountInfo(
      whirlpoolsConfigAddress
    );
    console.log(configAccount);

    const { tx, positionMintAddress, whirlpoolAddress } =
      await createGraduateTokenToOrcaTransaction(
        connection,
        whirlpoolsConfigAddress,
        signer,
        tokenMaxA,
        tokenMaxB,
        mintA,
        mintB
      );

    const txRes = await connection.sendTransaction(tx);
    console.log(txRes);
    console.log(ataAccountA);
  });
});

// test("spl logging", () => {
//   const programId = PublicKey.unique();
//   const svm = new LiteSVM();
//   svm.addProgramFromFile(programId, "program_bytes/spl_example_logging.so");
//   const payer = new Keypair();
//   svm.airdrop(payer.publicKey, BigInt(LAMPORTS_PER_SOL));
//   const blockhash = svm.latestBlockhash();
//   const ixs = [
//     new TransactionInstruction({
//       programId,
//       keys: [
//         { pubkey: PublicKey.unique(), isSigner: false, isWritable: false },
//       ],
//     }),
//   ];
//   const tx = new Transaction();
//   tx.recentBlockhash = blockhash;
//   tx.add(...ixs);
//   tx.sign(payer);
//   // let's sim it first
//   const simRes = svm.simulateTransaction(tx);
//   const sendRes = svm.sendTransaction(tx);
//   if (sendRes instanceof TransactionMetadata) {
//     expect(simRes.meta().logs()).toEqual(sendRes.logs());
//     expect(sendRes.logs()[1]).toBe("Program log: static string");
//   } else {
//     throw new Error("Unexpected tx failure");
//   }
// });
