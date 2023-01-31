import fs from 'node:fs/promises';
import path from 'node:path';
import SemanticReleaseError from '@semantic-release/error';
import type { Context } from 'semantic-release';
import { fromZodError } from 'zod-validation-error';
import { envSchema, pluginConfigSchema } from './common';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    } else {
      throw error;
    }
  }
}

export async function verifyConditions(
  pluginConfig: Readonly<Record<string, unknown>>,
  context: Readonly<Context>,
): Promise<void> {
  const { env } = context;

  const errors = [];

  const pluginConfigResult = pluginConfigSchema.safeParse(pluginConfig);
  if (!pluginConfigResult.success) {
    errors.push(
      new SemanticReleaseError(
        'The plugin configuration is invalid.',
        'EINVALIDPLUGINCONFIG',
        fromZodError(pluginConfigResult.error).message,
      ),
    );
  } else {
    const { addonDirPath } = pluginConfigResult.data;
    if (!(await exists(addonDirPath))) {
      errors.push(
        new SemanticReleaseError(
          `The add-on directory is not found at ${addonDirPath}.`,
          'EADDONDIRNOTFOUND',
        ),
      );
    } else {
      const manifestJsonPath = path.join(addonDirPath, 'manifest.json');
      if (!(await exists(manifestJsonPath))) {
        errors.push(
          new SemanticReleaseError(
            `manifest.json is not found at ${manifestJsonPath}.`,
            'EMANIFESTJSONNOTFOUND',
          ),
        );
      }
    }
  }

  const envResult = envSchema.safeParse(env);
  if (!envResult.success) {
    errors.push(
      new SemanticReleaseError(
        'The environment variables are invalid.',
        'EINVALIDENV',
        fromZodError(envResult.error).message,
      ),
    );
  }

  if (errors.length) {
    const { default: _AggregateError } = await import('aggregate-error');
    class AggregateError extends _AggregateError {
      constructor(errors: readonly Error[]) {
        super(errors);
      }
      *[Symbol.iterator](): IterableIterator<Error> {
        for (const error of this.errors) {
          yield error;
        }
      }
    }
    throw new AggregateError(errors);
  }
}
