const hasPrismaMethods = (type) =>
  Boolean(type.getProperty("$queryRaw") && type.getProperty("$executeRaw"));

const isPrismaType = (type) => {
  if (type.isUnionOrIntersection()) {
    return type.types.some(isPrismaType);
  }

  if (hasPrismaMethods(type)) {
    return true;
  }

  const symbol = type.getSymbol();

  if (!symbol?.getName().endsWith("Delegate")) {
    return false;
  }

  return Boolean(
    symbol.declarations?.some((declaration) =>
      declaration
        .getSourceFile()
        .statements.some(
          (statement) =>
            statement.name?.text === "PrismaClient" ||
            statement.moduleSpecifier?.text?.startsWith(
              "@prisma/client/runtime/",
            ),
        ),
    ) &&
    type.getProperty("findMany") &&
    type.getProperty("findUnique"),
  );
};

export const createPrismaTypeCheck = (context) => {
  const services = context.sourceCode.parserServices;
  const checker = services.program?.getTypeChecker();

  return (node) => {
    const original = services.esTreeNodeToTSNodeMap?.get(node);

    if (!checker || !original) {
      return false;
    }

    const type = checker.getTypeAtLocation(original);

    return (
      isPrismaType(type) ||
      type
        .getConstructSignatures()
        .some((signature) => isPrismaType(signature.getReturnType()))
    );
  };
};
