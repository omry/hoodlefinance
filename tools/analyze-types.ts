import { Project, SyntaxKind } from "ts-morph";

type ReferenceCriterion = {
  count: number;
  operator: "eq" | "gr" | "gte" | "lt" | "lte";
};

type CandidateKind = "Interface" | "Type";

type UsageSite = {
  filePath: string;
  line: number;
};

type Candidate = {
  kind: CandidateKind;
  name: string;
  usages: UsageSite[];
};

type CandidateSummary = Candidate & {
  usageCount: number;
};

type CliOptions = {
  criterion: ReferenceCriterion;
  reverse: boolean;
};

const DEFAULT_CRITERION: ReferenceCriterion = {
  count: 1,
  operator: "eq",
};

function parseCriterionValue(value: string): ReferenceCriterion {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(gr|gte|eq|lt|lte)(?:[:=](\d+))?$/i);

  if (!match) {
    throw new Error(
      `Invalid criteria "${value}". Expected forms like gr=2, gte=2, eq=1, lt=3, or lte=3.`,
    );
  }

  const operator = match[1]?.toLowerCase() as ReferenceCriterion["operator"];
  const count = Number(match[2] || 1);

  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid criteria count "${match[2] || ""}".`);
  }

  return { operator, count };
}

function parseCliOptions(argv: string[]): CliOptions {
  let criterion = DEFAULT_CRITERION;
  let reverse = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] || "";

    if (arg === "--reverse" || arg === "-r") {
      reverse = true;
      continue;
    }

    if (arg === "--criteria" || arg === "-c") {
      const nextArg = argv[index + 1];

      if (!nextArg || nextArg.startsWith("-")) {
        throw new Error("Missing value for --criteria.");
      }

      criterion = parseCriterionValue(nextArg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--criteria=")) {
      criterion = parseCriterionValue(arg.slice("--criteria=".length));
      continue;
    }

    if (arg.startsWith("-c=")) {
      criterion = parseCriterionValue(arg.slice("-c=".length));
      continue;
    }
  }

  return { criterion, reverse };
}

function matchesCriterion(
  count: number,
  criterion: ReferenceCriterion,
): boolean {
  if (criterion.operator === "eq") {
    return count === criterion.count;
  }

  if (criterion.operator === "gr") {
    return count > criterion.count;
  }

  if (criterion.operator === "gte") {
    return count >= criterion.count;
  }

  return count < criterion.count;
}

function compareCandidates(a: Candidate, b: Candidate, reverse: boolean): number {
  const countDelta = a.usages.length - b.usages.length;
  if (countDelta !== 0) {
    return reverse ? -countDelta : countDelta;
  }

  const kindDelta = a.kind.localeCompare(b.kind);
  if (kindDelta !== 0) {
    return kindDelta;
  }

  return a.name.localeCompare(b.name);
}

const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
const { criterion, reverse } = parseCliOptions(process.argv.slice(2));

const candidates: CandidateSummary[] = [];

console.log(
  `Scanning for single-use abstractions with criteria ${criterion.operator}=${criterion.count}${reverse ? " (reverse order)" : ""}...`,
);

for (const sourceFile of project.getSourceFiles()) {
  for (const iface of sourceFile.getInterfaces()) {
    const actualUsages = iface
      .findReferencesAsNodes()
      .filter(
        (node) =>
          node.getParent()?.getKind() !== SyntaxKind.InterfaceDeclaration &&
          node.getParent()?.getKind() !== SyntaxKind.ExportSpecifier,
      )
      .map((node) => ({
        filePath: node.getSourceFile().getFilePath(),
        line: node.getStartLineNumber(),
      }));

    if (matchesCriterion(actualUsages.length, criterion)) {
      candidates.push({
        kind: "Interface",
        name: iface.getName(),
        usageCount: actualUsages.length,
        usages: actualUsages,
      });
    }
  }

  for (const typeAlias of sourceFile.getTypeAliases()) {
    const actualUsages = typeAlias
      .findReferencesAsNodes()
      .filter(
        (node) =>
          node.getParent()?.getKind() !== SyntaxKind.TypeAliasDeclaration &&
          node.getParent()?.getKind() !== SyntaxKind.ExportSpecifier,
      )
      .map((node) => ({
        filePath: node.getSourceFile().getFilePath(),
        line: node.getStartLineNumber(),
      }));

    if (matchesCriterion(actualUsages.length, criterion)) {
      candidates.push({
        kind: "Type",
        name: typeAlias.getName(),
        usageCount: actualUsages.length,
        usages: actualUsages,
      });
    }
  }
}

candidates.sort((a, b) => compareCandidates(a, b, reverse));

for (const candidate of candidates) {
  console.log(
    `[MATCH] ${candidate.kind} '${candidate.name}' has ${candidate.usageCount} reference${candidate.usageCount === 1 ? "" : "s"}`,
  );

  for (const usage of candidate.usages) {
    console.log(`  -> ${usage.filePath}:${usage.line}`);
  }
}
