# semantic-release-amo

A semantic-release plugin to publish Firefox add-ons to AMO (addons.mozilla.org).

## Motivation

[semantic-release-firefox-add-on](https://github.com/tophat/semantic-release-firefox-add-on) is a great plugin to publish Firefox add-ons to AMO. However, it does not support submitting source code.

This plugin makes it possible to submit source code by using
[API V5](https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#version-sources).

## Usage

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "semantic-release-amo",
      {
        "addonId": "my-addon-id",
        "addonDirPath": "dist",
        "approvalNotes": "To build this add-on, please run `yarn && yarn build`",
        "submitSource": true
      }
    ]
  ]
}
```

## Steps

| Step               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `verifyConditions` | Verify the environment variables and the options. |
| `prepare`          | Update `manifest.json` and archive the add-on.    |
| `publish`          | Publish the add-on to AMO.                        |

## Environment variables

| Variable         | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| `AMO_API_KEY`    | **REQUIRED** The API key to publish the add-on to AMO.          |
| `AMO_API_SECRET` | **REQUIRED** The API secret to publish the add-on to AMO.       |
| `AMO_BASE_URL`   | The base URL of AMO. Defaults to `https://addons.mozilla.org/`. |

## Options

| Option               | Description                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `addonId`            | **REQUIRED** The id of the add-on. Can be either a slug or a GUID.                                                             |
| `addonDirPath`       | **REQUIRED** The path of the directory containing the add-on.                                                                  |
| `addonZipPath`       | The path of the zip file to archive the add-on. Defaults to `"./semantic-release-amo/${nextRelease.version}.zip"`.             |
| `channel`            | The channel to publish the add-on. Can be either `"listed"` or `"unlisted"`. Defaults to `"listed"`.                           |
| `approvalNotes`      | The notes for the Mozilla reviewers.                                                                                           |
| `compatibility`      | The applications that the add-on is compatible with. Can be an array of `"firefox"` or `"android"`. Defaults to `["firefox"]`. |
| `submitReleaseNotes` | Whether to submit the release notes typically generated by `@semantic-release/release-notes-generator`. Defaults to `false`.   |
| `submitSource`       | Whether to submit the source code archived by `git archive`. Defaults to `false`.                                              |

## Exported function

### updateAddon

```typescript
import { updateAddon } from 'semantic-release-amo/update-addon';

await updateAddon({
  apiKey: '...',
  apiSecret: '...',
  baseURL: 'https://addons.mozilla.org/', // optional, defaults to 'https://addons.mozilla.org/'
  addonId: '...',
  addonZipPath: await generateAddonZip(),
  channel: 'listed', // optional, defaults to 'listed'
  approvalNotes: '...', // optional
  compatibility: ['firefox'], // optional, defaults to ['firefox']
  releaseNotes: '...', // optional
  sourceZipPath: await generateSourceZip(), // optional
  logger: console, // optional, defaults to console
});
```

## Author

[iorate](https://github.com/iorate) ([Twitter](https://twitter.com/iorate))

## License

semantic-release-amo is licensed under [MIT License](LICENSE.txt).