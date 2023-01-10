import { FullContext, PluginConfig, applyContext, applyDefaults, createError } from './common';
import { UpdateAddonError, updateAddon } from './update-addon';

export async function publish(
  pluginConfig: Readonly<PluginConfig>,
  context: Readonly<FullContext>,
): Promise<{ name: string; url: string }> {
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
  const baseURL = env.AMO_BASE_URL ?? 'https://addons.mozilla.org/';

  if (approvalNotes === '') {
    logger.warn('Approval notes are empty. Skipping submission of approval notes.');
  }
  if (submitReleaseNotes && !nextRelease.notes) {
    logger.warn('Release notes are empty. Skipping submission of release notes.');
  }

  try {
    await updateAddon({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      apiKey: env.AMO_API_KEY!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      apiSecret: env.AMO_API_SECRET!,
      baseURL,
      addonId,
      addonZipPath,
      channel,
      approvalNotes: approvalNotes || null,
      compatibility,
      releaseNotes: (submitReleaseNotes && nextRelease.notes) || null,
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

  return {
    name: 'Firefox Add-ons',
    url: new URL(`/en-US/firefox/addon/${addonId}/`, baseURL).toString(),
  };
}
