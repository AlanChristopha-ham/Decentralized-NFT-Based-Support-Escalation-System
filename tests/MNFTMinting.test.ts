import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, noneCV, principalCV, responseErrorCV, responseOkCV, someCV, stringAsciiCV, stringUtf8CV, tupleCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 1000;
const ERR_INVALID_TIER = 1001;
const ERR_INSUFFICIENT_BALANCE = 1002;
const ERR_NFT_ALREADY_OWNED = 1003;
const ERR_INVALID_PRICE = 1004;
const ERR_INVALID_EXPIRY = 1005;
const ERR_NFT_NOT_FOUND = 1006;
const ERR_UPGRADE_NOT_ALLOWED = 1007;
const ERR_INVALID_OWNER = 1008;
const ERR_MAX_NFTS_EXCEEDED = 1009;
const ERR_INVALID_METADATA = 1010;
const ERR_AUTHORITY_NOT_SET = 1011;
const ERR_INVALID_TRANSFER = 1012;
const ERR_PAUSED = 1013;
const ERR_INVALID_BURN = 1014;
const ERR_INVALID_MINT_AMOUNT = 1015;
const ERR_TIER_NOT_ACTIVE = 1016;
const ERR_INVALID_ADMIN = 1017;
const ERR_METADATA_TOO_LONG = 1018;
const ERR_INVALID_TIMESTAMP = 1019;
const ERR_TRANSFER_NOT_ALLOWED = 1020;

interface NftTier {
  tierLevel: bigint;
  expiry: bigint | null;
  metadata: string;
}

interface HistoryEntry {
  action: string;
  timestamp: bigint;
  actor: string;
}

type Result<T> = { ok: boolean; value: T };

class NFTMintingMock {
  state: {
    nextNftId: bigint;
    maxNfts: bigint;
    mintFee: bigint;
    adminPrincipal: string;
    authorityContract: string | null;
    contractPaused: boolean;
    baseUri: string;
    nftOwners: Map<bigint, string>;
    ownerNfts: Map<string, bigint>;
    nftTiers: Map<bigint, NftTier>;
    tierPrices: Map<bigint, bigint>;
    tierActive: Map<bigint, boolean>;
    nftHistory: Map<bigint, HistoryEntry[]>;
  } = {
    nextNftId: 1n,
    maxNfts: 10000n,
    mintFee: 500n,
    adminPrincipal: "ST1ADMIN",
    authorityContract: null,
    contractPaused: false,
    baseUri: "ipfs://QmBaseURI/",
    nftOwners: new Map(),
    ownerNfts: new Map(),
    nftTiers: new Map(),
    tierPrices: new Map(),
    tierActive: new Map(),
    nftHistory: new Map(),
  };
  blockHeight: bigint = 0n;
  caller: string = "ST1USER";
  balances: Map<string, bigint> = new Map([["ST1USER", 10000n], ["ST1ADMIN", 0n]]);
  stxTransfers: Array<{ amount: bigint; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextNftId: 1n,
      maxNfts: 10000n,
      mintFee: 500n,
      adminPrincipal: "ST1ADMIN",
      authorityContract: null,
      contractPaused: false,
      baseUri: "ipfs://QmBaseURI/",
      nftOwners: new Map(),
      ownerNfts: new Map(),
      nftTiers: new Map(),
      tierPrices: new Map(),
      tierActive: new Map(),
      nftHistory: new Map(),
    };
    this.blockHeight = 0n;
    this.caller = "ST1USER";
    this.balances = new Map([["ST1USER", 10000n], ["ST1ADMIN", 0n]]);
    this.stxTransfers = [];
  }

  getNftOwner(nftId: bigint): string | null {
    return this.state.nftOwners.get(nftId) ?? null;
  }

  getOwnerNft(owner: string): bigint | null {
    return this.state.ownerNfts.get(owner) ?? null;
  }

  getNftTier(nftId: bigint): NftTier | null {
    return this.state.nftTiers.get(nftId) ?? null;
  }

  getTierPrice(tier: bigint): bigint | null {
    return this.state.tierPrices.get(tier) ?? null;
  }

  isTierActive(tier: bigint): boolean {
    return this.state.tierActive.get(tier) ?? false;
  }

  getNftHistory(nftId: bigint): HistoryEntry[] {
    return this.state.nftHistory.get(nftId) ?? [];
  }

  getNextNftId(): bigint {
    return this.state.nextNftId;
  }

  isOwner(nftId: bigint, user: string): boolean {
    return this.getNftOwner(nftId) === user;
  }

  setAuthorityContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    this.state.authorityContract = contract;
    return { ok: true, value: true };
  }

  setMintFee(newFee: bigint): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (newFee <= 0n) return { ok: false, value: false };
    this.state.mintFee = newFee;
    return { ok: true, value: true };
  }

  pauseContract(paused: boolean): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    this.state.contractPaused = paused;
    return { ok: true, value: true };
  }

  setTierPrice(tier: bigint, price: bigint): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (tier < 1n || tier > 3n) return { ok: false, value: false };
    if (price <= 0n) return { ok: false, value: false };
    this.state.tierPrices.set(tier, price);
    return { ok: true, value: true };
  }

  setTierActive(tier: bigint, active: boolean): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    if (tier < 1n || tier > 3n) return { ok: false, value: false };
    this.state.tierActive.set(tier, active);
    return { ok: true, value: true };
  }

  setBaseUri(newUri: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: false };
    this.state.baseUri = newUri;
    return { ok: true, value: true };
  }

  mintNft(tier: bigint, metadata: string): Result<bigint> {
    const nftId = this.state.nextNftId;
    const recipient = this.caller;
    if (this.state.contractPaused) return { ok: false, value: BigInt(ERR_PAUSED) };
    if (this.getOwnerNft(recipient) !== null) return { ok: false, value: BigInt(ERR_NFT_ALREADY_OWNED) };
    if (tier < 1n || tier > 3n) return { ok: false, value: BigInt(ERR_INVALID_TIER) };
    if (!this.isTierActive(tier)) return { ok: false, value: BigInt(ERR_TIER_NOT_ACTIVE) };
    if (metadata.length > 256) return { ok: false, value: BigInt(ERR_METADATA_TOO_LONG) };
    const price = this.getTierPrice(tier);
    if (price === null) return { ok: false, value: BigInt(ERR_INVALID_TIER) };
    const balance = this.balances.get(this.caller) ?? 0n;
    if (balance < price) return { ok: false, value: BigInt(ERR_INSUFFICIENT_BALANCE) };
    this.balances.set(this.caller, balance - price);
    this.balances.set(this.state.adminPrincipal, (this.balances.get(this.state.adminPrincipal) ?? 0n) + price);
    this.stxTransfers.push({ amount: price, from: this.caller, to: this.state.adminPrincipal });
    this.state.nftOwners.set(nftId, recipient);
    this.state.ownerNfts.set(recipient, nftId);
    this.state.nftTiers.set(nftId, { tierLevel: tier, expiry: null, metadata });
    this.state.nftHistory.set(nftId, [{ action: "mint", timestamp: this.blockHeight, actor: recipient }]);
    this.state.nextNftId += 1n;
    return { ok: true, value: nftId };
  }

  upgradeTier(nftId: bigint, newTier: bigint, newExpiry: bigint | null): Result<boolean> {
    const currentTier = this.getNftTier(nftId);
    if (currentTier === null) return { ok: false, value: false };
    const owner = this.getNftOwner(nftId);
    if (owner === null) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    if (newTier < 1n || newTier > 3n) return { ok: false, value: false };
    if (newTier <= currentTier.tierLevel) return { ok: false, value: false };
    if (newExpiry !== null && newExpiry <= this.blockHeight) return { ok: false, value: false };
    const currentPrice = this.getTierPrice(currentTier.tierLevel);
    const newPrice = this.getTierPrice(newTier);
    if (currentPrice === null || newPrice === null) return { ok: false, value: false };
    const upgradeCost = newPrice - currentPrice;
    const balance = this.balances.get(this.caller) ?? 0n;
    if (balance < upgradeCost) return { ok: false, value: false };
    this.balances.set(this.caller, balance - upgradeCost);
    this.balances.set(this.state.adminPrincipal, (this.balances.get(this.state.adminPrincipal) ?? 0n) + upgradeCost);
    this.stxTransfers.push({ amount: upgradeCost, from: this.caller, to: this.state.adminPrincipal });
    this.state.nftTiers.set(nftId, { tierLevel: newTier, expiry: newExpiry, metadata: currentTier.metadata });
    const history = this.getNftHistory(nftId);
    history.push({ action: "upgrade", timestamp: this.blockHeight, actor: owner });
    this.state.nftHistory.set(nftId, history.slice(-10));
    return { ok: true, value: true };
  }

  burnNft(nftId: bigint): Result<boolean> {
    const owner = this.getNftOwner(nftId);
    if (owner === null) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    this.state.nftOwners.delete(nftId);
    this.state.ownerNfts.delete(owner);
    this.state.nftTiers.delete(nftId);
    this.state.nftHistory.delete(nftId);
    return { ok: true, value: true };
  }

  transferNft(nftId: bigint, recipient: string): Result<boolean> {
    const owner = this.getNftOwner(nftId);
    if (owner === null) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    const tierInfo = this.getNftTier(nftId);
    if (tierInfo === null) return { ok: false, value: false };
    if (tierInfo.expiry !== null) return { ok: false, value: false };
    if (this.getOwnerNft(recipient) !== null) return { ok: false, value: false };
    this.state.nftOwners.set(nftId, recipient);
    this.state.ownerNfts.delete(owner);
    this.state.ownerNfts.set(recipient, nftId);
    const history = this.getNftHistory(nftId);
    history.push({ action: "transfer", timestamp: this.blockHeight, actor: recipient });
    this.state.nftHistory.set(nftId, history.slice(-10));
    return { ok: true, value: true };
  }

  adminMint(recipient: string, tier: bigint, metadata: string, expiry: bigint | null): Result<bigint> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: BigInt(ERR_NOT_AUTHORIZED) };
    const nftId = this.state.nextNftId;
    if (tier < 1n || tier > 3n) return { ok: false, value: BigInt(ERR_INVALID_TIER) };
    if (metadata.length > 256) return { ok: false, value: BigInt(ERR_METADATA_TOO_LONG) };
    if (expiry !== null && expiry <= this.blockHeight) return { ok: false, value: BigInt(ERR_INVALID_EXPIRY) };
    this.state.nftOwners.set(nftId, recipient);
    this.state.ownerNfts.set(recipient, nftId);
    this.state.nftTiers.set(nftId, { tierLevel: tier, expiry, metadata });
    this.state.nftHistory.set(nftId, [{ action: "admin-mint", timestamp: this.blockHeight, actor: recipient }]);
    this.state.nextNftId += 1n;
    return { ok: true, value: nftId };
  }

  updateMetadata(nftId: bigint, newMetadata: string): Result<boolean> {
    const tierInfo = this.getNftTier(nftId);
    if (tierInfo === null) return { ok: false, value: false };
    const owner = this.getNftOwner(nftId);
    if (owner === null) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    if (newMetadata.length > 256) return { ok: false, value: false };
    this.state.nftTiers.set(nftId, { ...tierInfo, metadata: newMetadata });
    const history = this.getNftHistory(nftId);
    history.push({ action: "metadata-update", timestamp: this.blockHeight, actor: owner });
    this.state.nftHistory.set(nftId, history.slice(-10));
    return { ok: true, value: true };
  }

  extendExpiry(nftId: bigint, newExpiry: bigint): Result<boolean> {
    const tierInfo = this.getNftTier(nftId);
    if (tierInfo === null) return { ok: false, value: false };
    const owner = this.getNftOwner(nftId);
    if (owner === null) return { ok: false, value: false };
    if (this.caller !== owner) return { ok: false, value: false };
    if (newExpiry <= this.blockHeight) return { ok: false, value: false };
    if (tierInfo.expiry !== null && newExpiry <= tierInfo.expiry) return { ok: false, value: false };
    this.state.nftTiers.set(nftId, { ...tierInfo, expiry: newExpiry });
    const history = this.getNftHistory(nftId);
    history.push({ action: "expiry-extend", timestamp: this.blockHeight, actor: owner });
    this.state.nftHistory.set(nftId, history.slice(-10));
    return { ok: true, value: true };
  }
}

describe("NFTMinting Contract Tests", () => {
  let contract: NFTMintingMock;

  beforeEach(() => {
    contract = new NFTMintingMock();
    contract.reset();
  });

  it("sets tier price successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setTierPrice(1n, 1000n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getTierPrice(1n)).toBe(1000n);
  });

  it("rejects set tier price by non-admin", () => {
    const result = contract.setTierPrice(1n, 1000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("mints NFT successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    const result = contract.mintNft(1n, "metadata");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1n);
    expect(contract.getNftOwner(1n)).toBe("ST1USER");
    expect(contract.getOwnerNft("ST1USER")).toBe(1n);
    const tier = contract.getNftTier(1n);
    expect(tier?.tierLevel).toBe(1n);
    expect(tier?.expiry).toBe(null);
    expect(tier?.metadata).toBe("metadata");
    expect(contract.balances.get("ST1USER")).toBe(9000n);
    expect(contract.balances.get("ST1ADMIN")).toBe(1000n);
  });

  it("rejects mint when paused", () => {
    contract.caller = "ST1ADMIN";
    contract.pauseContract(true);
    contract.caller = "ST1USER";
    const result = contract.mintNft(1n, "metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(BigInt(ERR_PAUSED));
  });

  it("rejects mint with invalid tier", () => {
    const result = contract.mintNft(4n, "metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(BigInt(ERR_INVALID_TIER));
  });

  it("rejects mint if already owned", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.mintNft(1n, "new-metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(BigInt(ERR_NFT_ALREADY_OWNED));
  });

  it("upgrades tier successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierPrice(2n, 2000n);
    contract.setTierActive(1n, true);
    contract.setTierActive(2n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.upgradeTier(1n, 2n, null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const tier = contract.getNftTier(1n);
    expect(tier?.tierLevel).toBe(2n);
    expect(contract.balances.get("ST1USER")).toBe(8000n);
    expect(contract.balances.get("ST1ADMIN")).toBe(2000n);
  });

  it("rejects upgrade to lower tier", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierPrice(2n, 2000n);
    contract.setTierActive(1n, true);
    contract.setTierActive(2n, true);
    contract.caller = "ST1USER";
    contract.mintNft(2n, "metadata");
    const result = contract.upgradeTier(1n, 1n, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("burns NFT successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.burnNft(1n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getNftOwner(1n)).toBe(null);
    expect(contract.getOwnerNft("ST1USER")).toBe(null);
    expect(contract.getNftTier(1n)).toBe(null);
  });

  it("rejects burn by non-owner", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    contract.caller = "ST2OTHER";
    const result = contract.burnNft(1n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("transfers NFT successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.transferNft(1n, "ST2OTHER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getNftOwner(1n)).toBe("ST2OTHER");
    expect(contract.getOwnerNft("ST1USER")).toBe(null);
    expect(contract.getOwnerNft("ST2OTHER")).toBe(1n);
  });

  it("rejects transfer if expiry set", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    contract.extendExpiry(1n, 100n);
    const result = contract.transferNft(1n, "ST2OTHER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("admin mints successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.adminMint("ST1USER", 1n, "metadata", null);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1n);
    expect(contract.getNftOwner(1n)).toBe("ST1USER");
    expect(contract.getNftTier(1n)?.tierLevel).toBe(1n);
  });

  it("rejects admin mint by non-admin", () => {
    const result = contract.adminMint("ST1USER", 1n, "metadata", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(BigInt(ERR_NOT_AUTHORIZED));
  });

  it("updates metadata successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "old-metadata");
    const result = contract.updateMetadata(1n, "new-metadata");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getNftTier(1n)?.metadata).toBe("new-metadata");
  });

  it("rejects metadata update by non-owner", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    contract.caller = "ST2OTHER";
    const result = contract.updateMetadata(1n, "new-metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("extends expiry successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.extendExpiry(1n, 100n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getNftTier(1n)?.expiry).toBe(100n);
  });

  it("rejects extend expiry to past", () => {
    contract.caller = "ST1ADMIN";
    contract.setTierPrice(1n, 1000n);
    contract.setTierActive(1n, true);
    contract.caller = "ST1USER";
    contract.mintNft(1n, "metadata");
    const result = contract.extendExpiry(1n, 0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});