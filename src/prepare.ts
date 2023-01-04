import fs from 'node:fs/promises';
import path from 'node:path';
import * as S from 'microstruct';
import zipDir from 'zip-dir';
import { FullContext, PluginConfig, applyContext, applyDefaults, createError } from './common';

export async function prepare(
  pluginConfig: Readonly<PluginConfig>,
  context: Readonly<FullContext>,
): Promise<void> {
  const {
    addonDirPath,
    addonZipPath: addonZipPathTemplate,
    submitSource,
    sourceZipPath: sourceZipPathTemplate,
  } = applyDefaults(pluginConfig);
  const addonZipPath = applyContext(addonZipPathTemplate, context);
  const sourceZipPath = applyContext(sourceZipPathTemplate, context);
  const { logger, nextRelease } = context;

  logger.log('Updating manifest.json...');
  const manifestJsonPath = path.join(addonDirPath, 'manifest.json');
  const mainfestJson = await fs.readFile(manifestJsonPath, 'utf8');
  const manifest = S.parse(mainfestJson, S.type({ version: S.optional(S.string()) }));
  if (!manifest) {
    throw createError(`Invalid manifest.json: ${manifestJsonPath}`);
  }
  manifest.version = nextRelease.version;
  await fs.writeFile(manifestJsonPath, JSON.stringify(manifest, null, 2), 'utf8');

  logger.log('Archiving the add-on...');
  await fs.mkdir(path.dirname(addonZipPath), { recursive: true });
  await zipDir(addonDirPath, { saveTo: addonZipPath });

  if (submitSource) {
    logger.log('Archiving the source code...');
    await fs.mkdir(path.dirname(sourceZipPath), { recursive: true });
    const { execa } = await import('execa');
    await execa('git', ['archive', '--format=zip', '-o', sourceZipPath, 'HEAD']);
  }
}
