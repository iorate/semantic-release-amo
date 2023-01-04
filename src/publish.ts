import { FullContext, PluginConfig, applyContext, applyDefaults, createError } from './common';
import { UpdateAddonError, updateAddon } from './update-addon';

export async function publish(
  pluginConfig: Readonly<PluginConfig>,
  context: Readonly<FullContext>,
): Promise<void> {
  const {
    addonId,
    addonZipPath: addonZipPathTemplate,
    channel,
    approvalNotes,
    compatibility,
    submitReleaseNotes,
    submitSource,
    sourceZipPath: sourceZipPathTemplate,
  } = applyDefaults(pluginConfig);
  const addonZipPath = applyContext(addonZipPathTemplate, context);
  const sourceZipPath = applyContext(sourceZipPathTemplate, context);
  const { env, logger, nextRelease } = context;

  if (approvalNotes === '') {
    logger.warn('Approval notes are empty. Skipping submission of approval notes.');
  }
  const releaseNotes = nextRelease.notes;
  if (submitReleaseNotes && !releaseNotes) {
    logger.warn('Release notes are empty. Skipping submission of release notes.');
  }

  try {
    await updateAddon({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      apiKey: env.AMO_API_KEY!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      apiSecret: env.AMO_API_SECRET!,
      baseURL: env.AMO_BASE_URL ?? 'https://addons.mozilla.org/api/v5/addons/',
      addonId,
      addonZipPath,
      channel,
      approvalNotes: approvalNotes || null,
      compatibility,
      releaseNotes: (submitReleaseNotes && releaseNotes) || null,
      sourceZipPath: submitSource ? sourceZipPath : null,
      logger,
    });
  } catch (error: unknown) {
    if (error instanceof UpdateAddonError) {
      throw createError(error.message);
    } else {
      throw error;
    }
  }
}
