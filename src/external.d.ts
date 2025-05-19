declare module "@semantic-release/error" {
  class SemanticReleaseError extends Error {
    constructor(message?: string, code?: string, details?: string);
  }
  export = SemanticReleaseError;
}

declare module "zip-dir" {
  function zipDir(
    dirPath: string,
    options?: { saveTo?: string },
  ): Promise<void>;
  export = zipDir;
}
