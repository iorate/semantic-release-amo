import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import SemanticReleaseError from "@semantic-release/error";
import { type Type, type } from "arktype";
import jwt from "jsonwebtoken";
import type { Signale } from "signale";

export type Channel = "unlisted" | "listed";
export type Application = "android" | "firefox";

export type UpdateAddonParams = {
  apiKey: string;
  apiSecret: string;
  baseURL: string;
  addonId: string;
  addonZipPath: string;
  channel: Channel;
  approvalNotes: string | null;
  compatibility: readonly Application[];
  releaseNotes: string | null;
  sourceZipPath: string | null;
  logger: Signale<"log">;
};

export async function updateAddon(
  params: Readonly<UpdateAddonParams>,
): Promise<void> {
  const {
    apiKey,
    apiSecret,
    baseURL,
    addonId,
    addonZipPath,
    channel,
    approvalNotes,
    compatibility,
    releaseNotes,
    sourceZipPath,
    logger,
  } = params;
  const apiParams = { apiKey, apiSecret, baseURL };

  logger.log("Uploading the add-on...");
  const { uuid: uploadId } = await createUpload(apiParams, {
    uploadPath: addonZipPath,
    channel,
  });

  logger.log("Waiting for validation...");
  await awaitValidation(apiParams, uploadId);

  logger.log("Creating a version...");
  const { id: versionId } = await createVersion(apiParams, addonId, {
    upload: uploadId,
    ...(approvalNotes != null ? { approval_notes: approvalNotes } : {}),
    compatibility,
    ...(releaseNotes != null
      ? { release_notes: { "en-US": releaseNotes } }
      : {}),
  });

  if (sourceZipPath != null) {
    logger.log("Uploading the source code...");
    await patchVersion(apiParams, addonId, versionId, {
      sourcePath: sourceZipPath,
    });
  }
}

function inspect(value: unknown): string {
  return util.inspect(value, {
    breakLength: Number.POSITIVE_INFINITY,
    depth: Number.POSITIVE_INFINITY,
  });
}

function jwtSign(key: string, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key,
    jti: Math.random().toString(),
    iat: issuedAt,
    exp: issuedAt + 300, // 5 minutes
  };
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}

function throwBadResponse(url: string, status: number, body: unknown): never {
  throw new SemanticReleaseError(
    `A bad response was received from ${url} with status ${status}.`,
    "EBADRESPONSE",
    inspect(body),
  );
}

type APIParams = Pick<UpdateAddonParams, "apiKey" | "apiSecret" | "baseURL">;

async function apiFetch<ResponseBodyType extends Type>(
  { apiKey, apiSecret, baseURL }: Readonly<APIParams>,
  method: string,
  path: string,
  body: Readonly<Record<string, unknown>> | FormData | null,
  responseBodyType: ResponseBodyType,
): Promise<ResponseBodyType["infer"]> {
  const requestURL = new URL(`/api/v5/addons/${path}`, baseURL);
  const requestHeaders: Record<string, string> = {
    Authorization: `JWT ${jwtSign(apiKey, apiSecret)}`,
  };
  let requestBody: string | FormData | null;
  if (body instanceof FormData || body == null) {
    requestBody = body;
  } else {
    requestHeaders["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  const response = await fetch(requestURL, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
  const responseBodyRaw = response.headers
    .get("Content-Type")
    ?.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throwBadResponse(response.url, response.status, responseBodyRaw);
  }
  const responseBody = responseBodyType(responseBodyRaw);
  if (responseBodyType instanceof type.errors) {
    throwBadResponse(response.url, response.status, responseBodyRaw);
  }
  return responseBody;
}

const Upload = type({
  uuid: "string",
  processed: "boolean",
  valid: "boolean",
  validation: "Record<string, unknown> | null",
});

type Upload = typeof Upload.infer;

async function createUpload(
  apiParams: Readonly<APIParams>,
  { uploadPath, channel }: Readonly<{ uploadPath: string; channel: Channel }>,
): Promise<Upload> {
  const formData = new FormData();
  formData.append(
    "upload",
    await fs.openAsBlob(uploadPath, { type: "application/zip" }),
    path.basename(uploadPath),
  );
  formData.append("channel", channel);
  return apiFetch(apiParams, "POST", "upload/", formData, Upload);
}

function getUpload(
  apiParams: Readonly<APIParams>,
  uuid: string,
): Promise<Upload> {
  return apiFetch(apiParams, "GET", `upload/${uuid}/`, null, Upload);
}

const Version = type({
  id: "number",
});

type Version = typeof Version.infer;

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
  return apiFetch(
    apiParams,
    "POST",
    `addon/${addonId}/versions/`,
    body,
    Version,
  );
}

async function patchVersion(
  apiParams: Readonly<APIParams>,
  addonId: string,
  id: number,
  { sourcePath }: Readonly<{ sourcePath: string }>,
): Promise<Version> {
  const formData = new FormData();
  formData.append(
    "source",
    await fs.openAsBlob(sourcePath, { type: "application/zip" }),
    path.basename(sourcePath),
  );
  return apiFetch(
    apiParams,
    "PATCH",
    `addon/${addonId}/versions/${id}/`,
    formData,
    Version,
  );
}

function awaitValidation(
  apiParams: Readonly<APIParams>,
  uuid: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let pollTimeout: NodeJS.Timeout | null = null;
    const abortTimeout = setTimeout(() => {
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
      reject(
        new SemanticReleaseError("Validation timed out.", "EVALIDATIONTIMEOUT"),
      );
    }, 300000); // 5 minutes
    const poll = () =>
      void getUpload(apiParams, uuid)
        .then(({ processed, valid, validation }) => {
          if (processed) {
            clearTimeout(abortTimeout);
            if (valid) {
              resolve();
            } else {
              reject(
                new SemanticReleaseError(
                  "Validation failed.",
                  "EVALIDATIONFAILURE",
                  inspect(validation),
                ),
              );
            }
          } else {
            pollTimeout = setTimeout(poll, 1000); // 1 second
          }
        })
        .catch((error) => {
          clearTimeout(abortTimeout);
          reject(error);
        });
    poll();
  });
}
