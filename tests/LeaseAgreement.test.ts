import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_LAND_ID = 101;
const ERR_INVALID_FARMER = 102;
const ERR_INVALID_DURATION = 103;
const ERR_INVALID_RENT_AMOUNT = 104;
const ERR_INVALID_PAYMENT_FREQUENCY = 105;
const ERR_INVALID_CROP_SHARE = 106;
const ERR_LEASE_ALREADY_EXISTS = 107;
const ERR_LEASE_NOT_FOUND = 108;
const ERR_LEASE_EXPIRED = 110;
const ERR_LEASE_NOT_ACTIVE = 111;
const ERR_INVALID_UPDATE_PARAM = 112;
const ERR_MAX_LEASES_EXCEEDED = 113;
const ERR_INVALID_CROP_TYPE = 114;
const ERR_INVALID_TERMINATION_FEE = 115;
const ERR_INVALID_GRACE_PERIOD = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_MIN_RENT = 121;
const ERR_INVALID_MAX_DURATION = 122;
const ERR_AUTHORITY_NOT_VERIFIED = 120;

interface Lease {
  landId: number;
  landowner: string;
  farmer: string;
  startBlock: number;
  duration: number;
  rentAmount: number;
  paymentFrequency: number;
  cropSharePercentage: number;
  cropType: string;
  terminationFee: number;
  gracePeriod: number;
  location: string;
  currency: string;
  isActive: boolean;
  minRent: number;
  maxDuration: number;
}

interface LeaseUpdate {
  updateDuration: number;
  updateRentAmount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LeaseAgreementMock {
  state: {
    nextLeaseId: number;
    maxLeases: number;
    creationFee: number;
    authorityContract: string | null;
    leases: Map<number, Lease>;
    leaseUpdates: Map<number, LeaseUpdate>;
    leasesByLandId: Map<number, number>;
  } = {
    nextLeaseId: 0,
    maxLeases: 1000,
    creationFee: 1000,
    authorityContract: null,
    leases: new Map(),
    leaseUpdates: new Map(),
    leasesByLandId: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextLeaseId: 0,
      maxLeases: 1000,
      creationFee: 1000,
      authorityContract: null,
      leases: new Map(),
      leaseUpdates: new Map(),
      leasesByLandId: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createLease(
    landId: number,
    farmer: string,
    duration: number,
    rentAmount: number,
    paymentFrequency: number,
    cropSharePercentage: number,
    cropType: string,
    terminationFee: number,
    gracePeriod: number,
    location: string,
    currency: string,
    minRent: number,
    maxDuration: number
  ): Result<number> {
    if (this.state.nextLeaseId >= this.state.maxLeases) return { ok: false, value: ERR_MAX_LEASES_EXCEEDED };
    if (landId <= 0) return { ok: false, value: ERR_INVALID_LAND_ID };
    if (farmer === this.caller) return { ok: false, value: ERR_INVALID_FARMER };
    if (duration <= 0 || duration > 52560) return { ok: false, value: ERR_INVALID_DURATION };
    if (rentAmount <= 0) return { ok: false, value: ERR_INVALID_RENT_AMOUNT };
    if (paymentFrequency <= 0) return { ok: false, value: ERR_INVALID_PAYMENT_FREQUENCY };
    if (cropSharePercentage > 100) return { ok: false, value: ERR_INVALID_CROP_SHARE };
    if (!["wheat", "corn", "soybean"].includes(cropType)) return { ok: false, value: ERR_INVALID_CROP_TYPE };
    if (terminationFee < 0) return { ok: false, value: ERR_INVALID_TERMINATION_FEE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minRent <= 0) return { ok: false, value: ERR_INVALID_MIN_RENT };
    if (maxDuration <= 0) return { ok: false, value: ERR_INVALID_MAX_DURATION };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.leasesByLandId.has(landId)) return { ok: false, value: ERR_LEASE_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextLeaseId;
    const lease: Lease = {
      landId,
      landowner: this.caller,
      farmer,
      startBlock: this.blockHeight,
      duration,
      rentAmount,
      paymentFrequency,
      cropSharePercentage,
      cropType,
      terminationFee,
      gracePeriod,
      location,
      currency,
      isActive: true,
      minRent,
      maxDuration,
    };
    this.state.leases.set(id, lease);
    this.state.leasesByLandId.set(landId, id);
    this.state.nextLeaseId++;
    return { ok: true, value: id };
  }

  getLease(id: number): Lease | null {
    return this.state.leases.get(id) || null;
  }

  updateLease(id: number, updateDuration: number, updateRentAmount: number): Result<boolean> {
    const lease = this.state.leases.get(id);
    if (!lease) return { ok: false, value: false };
    if (lease.landowner !== this.caller) return { ok: false, value: false };
    if (updateDuration <= 0 || updateDuration > 52560) return { ok: false, value: false };
    if (updateRentAmount <= 0) return { ok: false, value: false };

    const updated: Lease = {
      ...lease,
      duration: updateDuration,
      rentAmount: updateRentAmount,
      startBlock: this.blockHeight,
    };
    this.state.leases.set(id, updated);
    this.state.leaseUpdates.set(id, {
      updateDuration,
      updateRentAmount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  terminateLease(id: number): Result<boolean> {
    const lease = this.state.leases.get(id);
    if (!lease) return { ok: false, value: false };
    if (lease.landowner !== this.caller && lease.farmer !== this.caller) return { ok: false, value: false };
    if (!lease.isActive) return { ok: false, value: false };
    if (this.blockHeight < lease.startBlock + lease.duration) return { ok: false, value: false };
    this.state.leases.set(id, { ...lease, isActive: false });
    this.state.leasesByLandId.delete(lease.landId);
    return { ok: true, value: true };
  }

  getLeaseCount(): Result<number> {
    return { ok: true, value: this.state.nextLeaseId };
  }

  checkLeaseExistence(landId: number): Result<boolean> {
    return { ok: true, value: this.state.leasesByLandId.has(landId) };
  }
}

describe("LeaseAgreement", () => {
  let contract: LeaseAgreementMock;

  beforeEach(() => {
    contract = new LeaseAgreementMock();
    contract.reset();
  });

  it("creates a lease successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const lease = contract.getLease(0);
    expect(lease?.landId).toBe(1);
    expect(lease?.landowner).toBe("ST1TEST");
    expect(lease?.farmer).toBe("ST3FARMER");
    expect(lease?.duration).toBe(100);
    expect(lease?.rentAmount).toBe(500);
    expect(lease?.paymentFrequency).toBe(10);
    expect(lease?.cropSharePercentage).toBe(20);
    expect(lease?.cropType).toBe("wheat");
    expect(lease?.terminationFee).toBe(100);
    expect(lease?.gracePeriod).toBe(5);
    expect(lease?.location).toBe("FarmLocation");
    expect(lease?.currency).toBe("STX");
    expect(lease?.minRent).toBe(200);
    expect(lease?.maxDuration).toBe(1000);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate leases for land id", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    const result = contract.createLease(
      1,
      "ST4FARMER",
      200,
      1000,
      20,
      30,
      "corn",
      200,
      10,
      "AnotherFarm",
      "USD",
      400,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LEASE_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects lease creation without authority contract", () => {
    const result = contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid duration", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLease(
      1,
      "ST3FARMER",
      0,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DURATION);
  });

  it("rejects invalid rent amount", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLease(
      1,
      "ST3FARMER",
      100,
      0,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RENT_AMOUNT);
  });

  it("rejects invalid crop type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "invalid",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CROP_TYPE);
  });

  it("updates a lease successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    const result = contract.updateLease(0, 150, 600);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.duration).toBe(150);
    expect(lease?.rentAmount).toBe(600);
    const update = contract.state.leaseUpdates.get(0);
    expect(update?.updateDuration).toBe(150);
    expect(update?.updateRentAmount).toBe(600);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent lease", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateLease(99, 150, 600);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-landowner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateLease(0, 150, 600);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("terminates a lease successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    contract.blockHeight = 100;
    const result = contract.terminateLease(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.isActive).toBe(false);
    expect(contract.state.leasesByLandId.has(1)).toBe(false);
  });

  it("rejects termination before expiration", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    contract.blockHeight = 50;
    const result = contract.terminateLease(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(2000);
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority contract", () => {
    const result = contract.setCreationFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct lease count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    contract.createLease(
      2,
      "ST4FARMER",
      200,
      1000,
      20,
      30,
      "corn",
      200,
      10,
      "AnotherFarm",
      "USD",
      400,
      2000
    );
    const result = contract.getLeaseCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks lease existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    const result = contract.checkLeaseExistence(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkLeaseExistence(99);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses lease parameters with Clarity types", () => {
    const cropType = stringUtf8CV("wheat");
    const duration = uintCV(100);
    const rentAmount = uintCV(500);
    expect(cropType.value).toBe("wheat");
    expect(duration.value).toEqual(BigInt(100));
    expect(rentAmount.value).toEqual(BigInt(500));
  });

  it("rejects lease creation with invalid land id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createLease(
      0,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LAND_ID);
  });

  it("rejects lease creation with max leases exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxLeases = 1;
    contract.createLease(
      1,
      "ST3FARMER",
      100,
      500,
      10,
      20,
      "wheat",
      100,
      5,
      "FarmLocation",
      "STX",
      200,
      1000
    );
    const result = contract.createLease(
      2,
      "ST4FARMER",
      200,
      1000,
      20,
      30,
      "corn",
      200,
      10,
      "AnotherFarm",
      "USD",
      400,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_LEASES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});