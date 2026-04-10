const {
  buildPlanNodeFromSpec,
  isResolverPlanNode,
  materializeResolversByCode,
  PLAN_RESOLVER_CLASSES_BY_NAME,
} = require("../dist/ts/core/index.js");

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function createRuntimePlanLookup(definition, deps) {
  const resolverSpecsByCode = Object.create(null);

  for (const [code, spec] of Object.entries(definition || {})) {
    const normalizedCode = normalizeCode(code);

    if (
      normalizedCode === "TERMINAL" ||
      PLAN_RESOLVER_CLASSES_BY_NAME[String(spec && spec.type)]
    ) {
      continue;
    }

    resolverSpecsByCode[normalizedCode] = String(spec && spec.type);
  }

  const resolverRegistry = materializeResolversByCode(
    resolverSpecsByCode,
    deps,
  );
  const nodesByCode = Object.assign(Object.create(null), resolverRegistry.byCode);
  const refs = {
    getFxPlan: () => getPlanNode("DEFAULT-ATTRIBUTE:FX"),
  };

  function getNode(code) {
    const normalizedCode = normalizeCode(code);
    const existingNode = nodesByCode[normalizedCode];

    if (existingNode) {
      return existingNode;
    }

    if (normalizedCode === "TERMINAL") {
      throw new Error(
        `Runtime graph terminal node "${normalizedCode}" is not executable.`,
      );
    }

    const spec = definition[normalizedCode];
    if (!spec) {
      throw new Error(`Unknown runtime graph node "${normalizedCode}".`);
    }

    if (!PLAN_RESOLVER_CLASSES_BY_NAME[String(spec.type || "")]) {
      throw new Error(
        `Resolver node "${normalizedCode}" was not materialized during runtime initialization.`,
      );
    }

    const compiledNode = buildPlanNodeFromSpec(
      normalizedCode,
      spec,
      (nodeCode) =>
        normalizeCode(nodeCode) === "TERMINAL" ? null : getNode(nodeCode),
      null,
      { refs },
    );
    nodesByCode[normalizedCode] = compiledNode;

    return compiledNode;
  }

  function getPlanNode(code) {
    const node = getNode(code);

    if (!isResolverPlanNode(node)) {
      throw new Error(
        `Runtime graph node "${normalizeCode(code)}" is not a resolver plan node.`,
      );
    }

    return node;
  }

  return {
    getNode,
    getPlanNode,
  };
}

module.exports = {
  createRuntimePlanLookup,
};
