import { template } from "es-toolkit/compat";
import type { VerifyReleaseContext } from "semantic-release";
import { z } from "zod";

export const pluginConfigSchema = z.object({
  addonId: z.string(),
  addonDirPath: z.string(),
  addonZipPath: z.string().optional(),
  channel: z.enum(["unlisted", "listed"]).optional(),
  approvalNotes: z.string().min(1).nullable().optional(),
  compatibility: z.enum(["android", "firefox"]).array().min(1).optional(),
  submitReleaseNotes: z.boolean().optional(),
  submitSource: z.boolean().optional(),
  sourceZipPath: z.string().optional(),
});

export type PluginConfig = NoUndefined<z.infer<typeof pluginConfigSchema>>;

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

export const envSchema = z.object({
  AMO_API_KEY: z.string(),
  AMO_API_SECRET: z.string(),
  AMO_BASE_URL: z.string().url().optional(),
});

export type Env = NoUndefined<z.infer<typeof envSchema>>;

// For the `prepare` and `publish` steps
export type FullContext = Required<NoUndefined<VerifyReleaseContext>> & {
  env: Env;
};

export function applyContext(
  temp: string,
  { branch, lastRelease, nextRelease, commits }: Readonly<FullContext>,
): string {
  return template(temp)({ branch, lastRelease, nextRelease, commits });
}

// "exactOptionalPropertyTypes": true
type NoUndefined<T> = { [K in keyof T]: Exclude<T[K], undefined> };
