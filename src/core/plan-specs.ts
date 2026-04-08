export interface PlanSpec {
  resolverClass: string;
  nodeCodes?: string[];
}

export function normalizePlanSpecCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function addNormalizedCode(result: string[], code: string): void {
  const normalizedCode = normalizePlanSpecCode(code);
  if (normalizedCode && !result.includes(normalizedCode)) {
    result.push(normalizedCode);
  }
}

export function getPlanSpecNodeCodes(spec: PlanSpec): string[] {
  const result: string[] = [];
  for (const code of spec.nodeCodes || []) {
    addNormalizedCode(result, code);
  }
  return result;
}
