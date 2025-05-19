import { type } from "arktype";
import { template } from "es-toolkit/compat";
import type {
  PrepareContext as _PrepareContext,
  PublishContext as _PublishContext,
} from "semantic-release";

export const PluginConfig = type({
  addonId: "string",
  addonDirPath: "string",
  "addonZipPath?": "string",
  "channel?": "'unlisted' | 'listed'",
  "approvalNotes?": "string > 0 | null",
  "compatibility?": "('android' | 'firefox')[] > 0",
  "submitReleaseNotes?": "boolean",
  "submitSource?": "boolean",
  "sourceZipPath?": "string",
});

export type PluginConfig = typeof PluginConfig.infer;

export function applyDefaults(
  pluginConfig: Readonly<PluginConfig>,
): Required<PluginConfig> {
  return {
    addonZipPath: "./semantic-release-amo/${nextRelease.version}.zip",
    channel: "listed",
    approvalNotes: null,
    compatibility: ["firefox"],
    submitReleaseNotes: false,
    submitSource: false,
    sourceZipPath: "./semantic-release-amo/${nextRelease.version}-src.zip",
    ...pluginConfig,
  };
}

export const Env = type({
  AMO_API_KEY: "string",
  AMO_API_SECRET: "string",
  "AMO_BASE_URL?": "string",
});

export type Env = typeof Env.infer;

// For the `prepare` and `publish` steps
export type PrepareContext = _PrepareContext & { env: Env };
export type PublishContext = _PublishContext & { env: Env };

export function applyContext(
  temp: string,
  {
    branch,
    lastRelease,
    nextRelease,
    commits,
  }: Readonly<PrepareContext> | Readonly<PublishContext>,
): string {
  return template(temp)({ branch, lastRelease, nextRelease, commits });
}
