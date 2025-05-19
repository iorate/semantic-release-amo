import { marked } from "marked";
import {
  type PluginConfig,
  type PublishContext,
  applyContext,
  applyDefaults,
} from "./common.js";
import { updateAddon } from "./update-addon.js";

function parseReleaseNotes(releaseNotes: string): string {
  marked.use({
    renderer: {
      heading({ tokens }) {
        return `\n<b>${this.parser.parseInline(tokens)}</b>\n`;
      },
    },
  });
  return marked.parse(releaseNotes, { async: false }).trim();
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
