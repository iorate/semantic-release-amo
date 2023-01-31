import SemanticReleaseError from '@semantic-release/error';
import { marked } from 'marked';
import { FullContext, PluginConfig, applyContext, applyDefaults } from './common';
import { UpdateAddonError, updateAddon } from './update-addon';

function parseReleaseNotes(releaseNotes: string): string {
  marked.use({
    renderer: {
      heading: text => `\n<b>${text}</b>\n`,
    },
  });
  return marked.parse(releaseNotes).trim();
}

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

  if (submitReleaseNotes && !nextRelease.notes) {
    logger.warn('Release notes are empty. Skipping submission of release notes.');
  }

  try {
    await updateAddon({
      apiKey: env.AMO_API_KEY,
      apiSecret: env.AMO_API_SECRET,
      baseURL,
      addonId,
      addonZipPath,
      channel,
      approvalNotes: approvalNotes || null,
      compatibility,
      releaseNotes:
        submitReleaseNotes && nextRelease.notes ? parseReleaseNotes(nextRelease.notes) : null,
      sourceZipPath: submitSource ? sourceZipPath : null,
      logger,
    });
  } catch (error: unknown) {
    if (error instanceof UpdateAddonError) {
      throw new SemanticReleaseError(error.message, error.code, error.details);
    } else {
      throw error;
    }
  }

  return {
    name: 'Firefox Add-ons',
    url: new URL(`/en-US/firefox/addon/${addonId}/`, baseURL).toString(),
  };
}
