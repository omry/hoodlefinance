import { RawRequestInput } from "./request";
import { EnvelopeStatus, FlowEngine, type ExecutionTrace } from "./flow/engine";
export { Flow } from "./flow/resolve-flow";
import { Flow } from "./flow/resolve-flow";

function createRawRequestInput(
  identifier: string,
  attribute?: string,
): RawRequestInput {
  return new RawRequestInput(
    String(identifier || ""),
    String(attribute == null ? "price" : attribute).trim(),
  );
}

export class HoodleFinanceFlow extends Flow {
  resolveAttribute(identifier: string, attribute = "price"): unknown {
    const rawInput = createRawRequestInput(identifier, attribute);
    const engine = new FlowEngine(this);
    const engineResult = engine.execute({ value: rawInput });

    if (engineResult.status !== EnvelopeStatus.Success) {
      throw new Error(
        String(engineResult.error || "").trim() || "Lookup failed.",
      );
    }

    return (engineResult.value as { extractedValue: unknown }).extractedValue;
  }

  resolveAttributeWithTrace(
    identifier: string,
    attribute = "price",
  ): {
    error?: string;
    path: string[];
    status: EnvelopeStatus;
    value: unknown;
  } {
    const rawInput = createRawRequestInput(identifier, attribute);
    const engine = new FlowEngine(this);
    const trace: ExecutionTrace = { visitedNodeIds: [] };
    const engineResult = engine.execute({ value: rawInput }, trace);

    if (engineResult.status !== EnvelopeStatus.Success) {
      const error = String(engineResult.error || "").trim();
      return {
        ...(error ? { error } : {}),
        path: trace.visitedNodeIds,
        status: engineResult.status || EnvelopeStatus.Failure,
        value: null,
      };
    }

    return {
      path: trace.visitedNodeIds,
      status: EnvelopeStatus.Success,
      value: (engineResult.value as { extractedValue: unknown }).extractedValue,
    };
  }
}

export function resolveAttribute(
  flow: Flow,
  identifier: string,
  attribute = "price",
): unknown {
  const rawInput = createRawRequestInput(identifier, attribute);
  const engine = new FlowEngine(flow);
  const engineResult = engine.execute({ value: rawInput });

  if (engineResult.status !== EnvelopeStatus.Success) {
    throw new Error(
      String(engineResult.error || "").trim() || "Lookup failed.",
    );
  }

  return (engineResult.value as { extractedValue: unknown }).extractedValue;
}

export function resolveAttributeWithTrace(
  flow: Flow,
  identifier: string,
  attribute = "price",
): {
  error?: string;
  path: string[];
  status: EnvelopeStatus;
  value: unknown;
} {
  const rawInput = createRawRequestInput(identifier, attribute);
  const engine = new FlowEngine(flow);
  const trace: ExecutionTrace = { visitedNodeIds: [] };
  const engineResult = engine.execute({ value: rawInput }, trace);

  if (engineResult.status !== EnvelopeStatus.Success) {
    const error = String(engineResult.error || "").trim();
    return {
      ...(error ? { error } : {}),
      path: trace.visitedNodeIds,
      status: engineResult.status || EnvelopeStatus.Failure,
      value: null,
    };
  }

  return {
    path: trace.visitedNodeIds,
    status: EnvelopeStatus.Success,
    value: (engineResult.value as { extractedValue: unknown }).extractedValue,
  };
}
