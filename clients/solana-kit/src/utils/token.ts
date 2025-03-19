import { Address, getAddressEncoder } from "@solana/kit";

export function orderMints(mint1: Address, mint2: Address): [Address, Address] {
    const encoder = getAddressEncoder();
    const mint1Bytes = new Uint8Array(encoder.encode(mint1));
    const mint2Bytes = new Uint8Array(encoder.encode(mint2));
    return Buffer.compare(mint1Bytes, mint2Bytes) < 0
      ? [mint1, mint2]
      : [mint2, mint1];
  }