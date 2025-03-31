import { ORCA_WHIRLPOOL_PROGRAM_ID } from "@orca-so/whirlpools-sdk";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Blockhash,
  Transaction,
  VersionedTransaction,
  PublicKey,
  AccountInfo,
  EpochInfo,
} from "@solana/web3.js";
import { LiteSVM } from "litesvm";
import { setupConfigAndFeeTiers, WHIRLPOOL_CPI_PROGRAM_ID } from "./program";

function setupSigner(svm: LiteSVM) {
  const signer = Keypair.generate();
  svm.airdrop(signer.publicKey, 500n * BigInt(LAMPORTS_PER_SOL));
  return signer;
}

export class MockConnection extends Connection {
  private liteSvm: LiteSVM;

  constructor(liteSvm: LiteSVM) {
    super("http://localhost:8899", "confirmed");
    this.liteSvm = liteSvm;
  }

  // Override relevant methods to use LiteSVM
  async getLatestBlockhash(): Promise<{
    blockhash: Blockhash;
    lastValidBlockHeight: number;
  }> {
    return {
      blockhash: this.liteSvm.latestBlockhash(),
      lastValidBlockHeight: 9999999,
    };
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<string> {
    const txMetaData = this.liteSvm.sendTransaction(transaction);
    return txMetaData.toString();
  }

  async getAccountInfo(
    address: PublicKey | string
  ): Promise<AccountInfo<Buffer> | null> {
    const publicKey =
      typeof address === "string" ? new PublicKey(address) : address;
    const accountInfo = this.liteSvm.getAccount(publicKey);

    return {
      ...accountInfo,
      data: Buffer.from(accountInfo.data),
    };
  }

  async getEpochInfo(): Promise<EpochInfo> {
    return {
      epoch: 1,
      slotIndex: 10000,
      slotsInEpoch: 0,
      absoluteSlot: 0,
    };
  }
}

const svm = new LiteSVM().withSysvars().withSplPrograms();
svm.addProgramFromFile(
  ORCA_WHIRLPOOL_PROGRAM_ID,
  "./tests/fixtures/whirlpool.so"
);
svm.addProgramFromFile(
  WHIRLPOOL_CPI_PROGRAM_ID,
  "./tests/fixtures/whirlpool_cpi.so"
);
export const signer = setupSigner(svm);
export const connection = new MockConnection(svm);
export const whirlpoolsConfigAddress = await setupConfigAndFeeTiers();
