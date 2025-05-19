import fs from "node:fs/promises";
import path from "node:path";
import SemanticReleaseError from "@semantic-release/error";
import { type } from "arktype";
import type { VerifyReleaseContext } from "semantic-release";
import { Env, PluginConfig } from "./common.js";

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

export async function verifyConditions(
  pluginConfigRaw: Readonly<Record<string, unknown>>,
  context: Readonly<VerifyReleaseContext>,
): Promise<void> {
  const errors = [];

  const pluginConfig = PluginConfig(pluginConfigRaw);
  if (pluginConfig instanceof type.errors) {
    errors.push(
      new SemanticReleaseError(
        "The plugin configuration is invalid.",
        "EINVALIDPLUGINCONFIG",
        pluginConfig.summary,
      ),
    );
  } else {
    const { addonDirPath } = pluginConfig;
    if (!(await exists(addonDirPath))) {
      errors.push(
        new SemanticReleaseError(
          `The add-on directory is not found at ${addonDirPath}.`,
          "EADDONDIRNOTFOUND",
        ),
      );
    } else {
      const manifestJsonPath = path.join(addonDirPath, "manifest.json");
      if (!(await exists(manifestJsonPath))) {
        errors.push(
          new SemanticReleaseError(
            `manifest.json is not found at ${manifestJsonPath}.`,
            "EMANIFESTJSONNOTFOUND",
          ),
        );
      }
    }
  }

  const env = Env(context.env);
  if (env instanceof type.errors) {
    errors.push(
      new SemanticReleaseError(
        "The environment variables are invalid.",
        "EINVALIDENV",
        env.summary,
      ),
    );
  }

  if (errors.length) {
    throw new AggregateError(errors);
  }
}
