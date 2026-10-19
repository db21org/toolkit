export type GraphqlFileDescriptor = Readonly<{
  folderRole: string;
  name: string;
  owner: string;
  ownerKey: string;
  ownerRoot: string;
  projectPath: string;
  role: string;
}>;

export type GraphqlConventionIssue = Readonly<{
  column: number;
  line: number;
  message: string;
}>;

export type GraphqlLayoutOptions = Readonly<{
  moduleRoots?: readonly string[];
  graphqlDirectory?: string;
  documentExtensions?: readonly ("gql" | "graphql")[];
}>;

export type GraphqlScalarMappings = Readonly<
  Record<string, string | Readonly<{ input: string; output: string }>>
>;

export declare const FEATURE_GRAPHQL_SCALAR_MAPPINGS: GraphqlScalarMappings;

export declare const collectUnmappedCustomScalars: (
  schemaSource: string,
  scalarMappings?: GraphqlScalarMappings,
) => string[];
export declare const describeGraphqlFile: (
  appRoot: string,
  filePath: string,
  layout?: GraphqlLayoutOptions,
) => GraphqlFileDescriptor | undefined;
export declare const findGraphqlFiles: (
  appRoot: string,
  options?: Readonly<{ sourceRoot?: string }>,
) => string[];
export declare const validateGraphqlFile: (
  options: GraphqlLayoutOptions &
    Readonly<{
      appRoot: string;
      filePath: string;
      source: string;
    }>,
) => GraphqlConventionIssue[];
