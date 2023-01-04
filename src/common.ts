import SemanticReleaseError from '@semantic-release/error';
import template from 'lodash.template';
import * as S from 'microstruct';
import type { Context } from 'semantic-release';

export function createError(message: string): SemanticReleaseError {
  return new SemanticReleaseError(message, '\u{1f98a}');
}

export const pluginConfigStruct = S.type({
  addonId: S.string(),
  addonDirPath: S.string(),
  addonZipPath: S.optional(S.string()),
  channel: S.optional(S.enums(['unlisted', 'listed'] as const)),
  approvalNotes: S.optional(S.nullable(S.string())),
  compatibility: S.optional(S.array(S.enums(['android', 'firefox'] as const))),
  submitReleaseNotes: S.optional(S.boolean()),
  submitSource: S.optional(S.boolean()),
  sourceZipPath: S.optional(S.string()),
});

export type PluginConfig = S.Infer<typeof pluginConfigStruct>;

export function applyDefaults(pluginConfig: Readonly<PluginConfig>): Required<PluginConfig> {
  return {
    addonZipPath: './semantic-release-amo/${nextRelease.version}.zip',
    channel: 'listed',
    approvalNotes: null,
    compatibility: ['firefox'],
    submitReleaseNotes: false,
    submitSource: false,
    sourceZipPath: './semantic-release-amo/${nextRelease.version}-src.zip',
    ...pluginConfig,
  };
}

// For `prepare` and `publish` steps
export type FullContext = { [K in keyof Context]-?: Exclude<Context[K], undefined> };

export function applyContext(
  temp: string,
  { branch, lastRelease, nextRelease, commits }: Readonly<FullContext>,
): string {
  return template(temp)({ branch, lastRelease, nextRelease, commits });
}
