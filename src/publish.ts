import {
  applyContext,
  applyDefaults,
  type PluginConfig,
  type PublishContext,
} from "./common.js";
import { updateAddon } from "./update-addon.js";

function parseReleaseNotes(releaseNotes: string): string {
  return releaseNotes.replaceAll(/^#{1,6}\s+(.+)$/gm, "**$1**");
}

export async function publish(
  pluginConfig: Readonly<PluginConfig>,
  context: Readonly<PublishContext>,
): Promise<{ name: string; url: string }> {
  const {
    addonId,
    addonZipPath: addonZipPathTemplate,
    channel,
    approvalNotes: approvalNotesTemplate,
    compatibility,
    submitReleaseNotes,
    submitSource,
    sourceZipPath: sourceZipPathTemplate,
  } = applyDefaults(pluginConfig);
  const addonZipPath = applyContext(addonZipPathTemplate, context);
  const approvalNotes =
    approvalNotesTemplate && applyContext(approvalNotesTemplate, context);
  const sourceZipPath = applyContext(sourceZipPathTemplate, context);
  const {
    env: {
      AMO_API_KEY: apiKey,
      AMO_API_SECRET: apiSecret,
      AMO_BASE_URL: baseURL = "https://addons.mozilla.org/",
    },
    logger,
    nextRelease,
  } = context;

  if (submitReleaseNotes && !nextRelease.notes) {
    logger.warn(
      "Release notes are empty. Skipping submission of release notes.",
    );
  }

  await updateAddon({
    apiKey,
    apiSecret,
    baseURL,
    addonId,
    addonZipPath,
    channel,
    approvalNotes,
    compatibility,
    releaseNotes:
      submitReleaseNotes && nextRelease.notes
        ? parseReleaseNotes(nextRelease.notes)
        : null,
    sourceZipPath: submitSource ? sourceZipPath : null,
    logger,
  });

  return {
    name: "Firefox Add-ons",
    url: new URL(`/en-US/firefox/addon/${addonId}/`, baseURL).toString(),
  };
}
