type ErrorRecord = Record<string, unknown>;

function asRecord(value: unknown): ErrorRecord | null {
  return typeof value === "object" && value !== null ? value as ErrorRecord : null;
}

export function providerErrorCode(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    const record = asRecord(current);
    if (!record) return undefined;
    const code = Number(record.code);
    if (Number.isFinite(code)) return code;
    current = record.cause ?? record.data ?? record.originalError;
  }
  return undefined;
}

function providerErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    const record = asRecord(current);
    if (!record) break;
    if (typeof record.message === "string") messages.push(record.message.toLowerCase());
    current = record.cause ?? record.data ?? record.originalError;
  }
  return messages;
}

export function isImmediateOrCancelNoFillError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === "string") {
      const value = current.toLowerCase();
      if (value.includes("immediateorcancelnofill") || value.includes("0xd48c4403")) return true;
      return false;
    }
    const record = asRecord(current);
    if (!record) return false;
    if (typeof record.message === "string") {
      const message = record.message.toLowerCase();
      if (message.includes("immediateorcancelnofill") || message.includes("0xd48c4403")) return true;
    }
    if (record.errorName === "ImmediateOrCancelNoFill") return true;
    const candidates = [record.cause, record.data, record.originalError, record.details];
    current = candidates.find((candidate) => candidate != null);
  }
  return false;
}

export function isUnrecognizedChainError(error: unknown): boolean {
  if (providerErrorCode(error) === 4902) return true;
  return providerErrorMessages(error).some((message) =>
    message.includes("unrecognized chain")
    || message.includes("unknown chain")
    || message.includes("chain has not been added")
    || message.includes("chain is not configured")
  );
}

export function describeWalletError(error: unknown, stage: "connect" | "network" | "transaction"): string {
  const code = providerErrorCode(error);
  if (code === 4001) {
    if (stage === "connect") return "Connection was cancelled in the wallet. Open the wallet and approve the account request, then try again.";
    if (stage === "transaction") return "The transaction was cancelled in the wallet. No claim was submitted.";
    return "The Somnia network request was cancelled in the wallet. Approve the network change, then try again.";
  }
  if (code === -32002) return "A wallet request is already waiting for approval. Open the wallet extension and complete or reject that pending request.";
  if (code === 4902) return "Somnia Shannon is not configured in this wallet and could not be added automatically.";

  const record = asRecord(error);
  const message = typeof record?.message === "string" ? record.message.trim() : "";
  if (message) return `Wallet error: ${message.slice(0, 180)}`;
  if (stage === "connect") return "The wallet did not complete the connection request.";
  if (stage === "transaction") return "The wallet did not complete the transaction request.";
  return "The wallet could not switch to Somnia Shannon.";
}
