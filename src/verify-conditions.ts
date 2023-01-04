import fs from 'node:fs/promises';
import path from 'node:path';
import * as S from 'microstruct';
import type { Context } from 'semantic-release';
import { createError, pluginConfigStruct } from './common';

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

  if (!S.is(pluginConfig, pluginConfigStruct)) {
    errors.push(createError(`Invalid plugin config: ${JSON.stringify(pluginConfig)}`));
  } else if (!(await exists(pluginConfig.addonDirPath))) {
    errors.push(createError(`Missing add-on directory: ${pluginConfig.addonDirPath}`));
  } else {
    const mainfestJsonPath = path.join(pluginConfig.addonDirPath, 'manifest.json');
    if (!(await exists(mainfestJsonPath))) {
      errors.push(createError(`Missing manifest.json: ${mainfestJsonPath}`));
    }
  }

  if (env.AMO_API_KEY == null) {
    errors.push(createError('Missing environment variable: AMO_API_KEY'));
  }
  if (env.AMO_API_SECRET == null) {
    errors.push(createError('Missing environment variable: AMO_API_SECRET'));
  }

  if (errors.length) {
    const { default: AggregateError } = await import('aggregate-error');
    throw new AggregateError(errors);
  }
}
