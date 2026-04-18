import { RawRequestInput } from "./request";
import {
  EnvelopeStatus,
  FlowEngine,
  type ExecutionTrace,
} from "./flow/engine";
export { ResolveFlow } from "./flow/resolve-flow";
import { ResolveFlow } from "./flow/resolve-flow";

function createRawRequestInput(identifier: string, attribute?: string): RawRequestInput {
  return new RawRequestInput(
    String(identifier || ""),
    String(attribute == null ? "price" : attribute).trim(),
  );
}

export function resolveAttribute(flow: ResolveFlow, identifier: string, attribute = "price"): unknown {
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
  flow: ResolveFlow,
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
