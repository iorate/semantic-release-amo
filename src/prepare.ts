import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import SemanticReleaseError from "@semantic-release/error";
import Zip from "adm-zip";
import { type } from "arktype";
import { execa } from "execa";
import {
  applyContext,
  applyDefaults,
  type PluginConfig,
  type PrepareContext,
} from "./common.js";

type ZipWithAddLocalFileAsync = Zip & {
  addLocalFileAsync(
    options:
      | {
          localPath: string;
          zipPath?: string;
          zipName?: string;
          comment?: string;
        }
      | string,
    callback: (err: Error | undefined, done: boolean) => void,
  ): void;
};

export async function prepare(
  pluginConfig: Readonly<PluginConfig>,
  context: Readonly<PrepareContext>,
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

  logger.log("Updating manifest.json...");
  const manifestJsonPath = path.join(addonDirPath, "manifest.json");
  const manifestJson = await fs.readFile(manifestJsonPath, "utf8");
  const manifest = type("string.json.parse").to("Record<string, unknown>")(
    manifestJson,
  );
  if (manifest instanceof type.errors) {
    throw new SemanticReleaseError(
      `An invalid manifest was read from ${manifestJsonPath}.`,
      "EINVALIDMANIFEST",
    );
  }
  manifest.version = nextRelease.version;
  await fs.writeFile(
    manifestJsonPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  logger.log("Archiving the add-on...");
  await fs.mkdir(path.dirname(addonZipPath), { recursive: true });
  const addonZip = new Zip();
  await addonZip.addLocalFolderPromise(addonDirPath, {});
  await addonZip.writeZipPromise(addonZipPath);

  if (submitSource) {
    logger.log("Archiving the source code...");
    const { stdout: files } = await execa({
      lines: true,
    })`git ls-files --recurse-submodules`;
    await fs.mkdir(path.dirname(sourceZipPath), { recursive: true });
    const sourceZip = new Zip() as ZipWithAddLocalFileAsync;
    const addLocalFilePromise = util.promisify(
      sourceZip.addLocalFileAsync.bind(sourceZip),
    );
    await Promise.all(
      files.map((file) =>
        addLocalFilePromise({ localPath: file, zipPath: path.dirname(file) }),
      ),
    );
    await sourceZip.writeZipPromise(sourceZipPath);
  }
}
