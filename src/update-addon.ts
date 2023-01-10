import fs from 'node:fs';
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import * as S from 'microstruct';

export class UpdateAddonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export type Channel = 'unlisted' | 'listed';
export type Application = 'android' | 'firefox';

export type UpdateAddonParams = {
  apiKey: string;
  apiSecret: string;
  baseURL?: string;
  addonId: string;
  addonZipPath: string;
  channel?: Channel;
  approvalNotes?: string | null;
  compatibility?: readonly Application[];
  releaseNotes?: string | null;
  sourceZipPath?: string | null;
  logger?: Readonly<{
    log(...messages: readonly unknown[]): void;
  }>;
};

export async function updateAddon({
  apiKey,
  apiSecret,
  baseURL = 'https://addons.mozilla.org/',
  addonId,
  addonZipPath,
  channel = 'listed',
  approvalNotes = null,
  compatibility = ['firefox'],
  releaseNotes = null,
  sourceZipPath = null,
  logger = console,
}: Readonly<UpdateAddonParams>): Promise<void> {
  const apiParams = { apiKey, apiSecret, baseURL };

  logger.log('Uploading the add-on...');
  const { uuid: uploadId } = await createUpload(apiParams, {
    upload: fs.createReadStream(addonZipPath),
    channel,
  });

  logger.log('Waiting for validation...');
  await waitForValidation(apiParams, uploadId);

  logger.log('Creating a version...');
  const { id: versionId } = await createVersion(apiParams, addonId, {
    upload: uploadId,
    ...(approvalNotes != null ? { approval_notes: approvalNotes } : {}),
    compatibility,
    ...(releaseNotes != null ? { release_notes: { 'en-US': releaseNotes } } : {}),
  });

  if (sourceZipPath != null) {
    logger.log('Uploading the source code...');
    await patchVersion(apiParams, addonId, versionId, {
      source: fs.createReadStream(sourceZipPath),
    });
  }
}

function jwtSign(key: string, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key,
    jti: Math.random().toString(),
    iat: issuedAt,
    exp: issuedAt + 300, // 5 minutes
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

function throwBadResponse(path: string, response: AxiosResponse): never {
  throw new UpdateAddonError(
    `Bad response from ${path} with ${response.status}: ${JSON.stringify(response.data)}`,
  );
}

type APIParams = Pick<UpdateAddonParams, 'apiKey' | 'apiSecret' | 'baseURL'>;

async function apiFetch<T>(
  { apiKey, apiSecret, baseURL }: Readonly<APIParams>,
  method: string,
  path: string,
  body: Readonly<Record<string, unknown>> | FormData | null,
  validator: S.Struct<T>,
): Promise<T> {
  try {
    const response = await axios({
      url: new URL(`/api/v5/addons/${path}`, baseURL).toString(),
      method,
      headers: {
        Authorization: `JWT ${jwtSign(apiKey, apiSecret)}`,
      },
      data: body,
    });
    if (!S.is(response.data, validator)) {
      throwBadResponse(path, response);
    }
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throwBadResponse(path, error.response);
    } else {
      throw error;
    }
  }
}

const uploadStruct = S.type({
  uuid: S.string(),
  processed: S.boolean(),
  valid: S.boolean(),
  validation: S.nullable(S.record(S.string(), S.unknown())),
});

type Upload = S.Infer<typeof uploadStruct>;

function createUpload(
  apiParams: Readonly<APIParams>,
  { upload, channel }: Readonly<{ upload: fs.ReadStream; channel: Channel }>,
): Promise<Upload> {
  const formData = new FormData();
  formData.append('upload', upload);
  formData.append('channel', channel);
  return apiFetch(apiParams, 'POST', 'upload/', formData, uploadStruct);
}

function getUpload(apiParams: Readonly<APIParams>, uuid: string): Promise<Upload> {
  return apiFetch(apiParams, 'GET', `upload/${uuid}/`, null, uploadStruct);
}

const versionStruct = S.type({ id: S.number() });

type Version = S.Infer<typeof versionStruct>;

function createVersion(
  apiParams: Readonly<APIParams>,
  addonId: string,
  body: Readonly<{
    upload: string;
    approval_notes?: string;
    compatibility?: readonly Application[];
    release_notes?: Readonly<Record<string, string>>;
  }>,
): Promise<Version> {
  return apiFetch(apiParams, 'POST', `addon/${addonId}/versions/`, body, versionStruct);
}

function patchVersion(
  apiParams: Readonly<APIParams>,
  addonId: string,
  id: number,
  { source }: Readonly<{ source: fs.ReadStream }>,
): Promise<Version> {
  const formData = new FormData();
  formData.append('source', source);
  return apiFetch(apiParams, 'PATCH', `addon/${addonId}/versions/${id}/`, formData, versionStruct);
}

function waitForValidation(apiParams: Readonly<APIParams>, uuid: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let intervalId: NodeJS.Timeout | null = null;
    const timeoutId = setTimeout(() => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
      reject(new UpdateAddonError('Validation Timeout'));
    }, 300000); // 5 minutes
    const poll = () =>
      void getUpload(apiParams, uuid)
        .then(({ processed, valid, validation }) => {
          if (processed) {
            clearTimeout(timeoutId);
            if (valid) {
              resolve();
            } else {
              reject(new UpdateAddonError(`Validation Error: ${JSON.stringify(validation)}`));
            }
          } else {
            intervalId = setTimeout(poll, 1000); // 1 second
          }
        })
        .catch(error => reject(error));
    poll();
  });
}
