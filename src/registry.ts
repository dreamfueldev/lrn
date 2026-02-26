/**
 * Registry API Client
 *
 * Fetch-based client for the lrn registry. Uses globalThis.fetch for testability.
 */

import {
  ArgumentError,
  NetworkError,
  RegistryAuthError,
  RegistryForbiddenError,
  RegistryRateLimitError,
} from "./errors.js";

function splitDomainName(fullName: string): { domain: string; name: string } {
  const slash = fullName.indexOf("/");
  if (slash === -1) throw new ArgumentError(`Invalid package name: ${fullName}. Expected domain/name format.`);
  return { domain: fullName.slice(0, slash), name: fullName.slice(slash + 1) };
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface DeviceTokenResult {
  status: "success" | "pending" | "expired";
  token?: string;
}

export interface SessionInfo {
  user: { name: string; email: string; image?: string };
}

export interface MeResponse {
  user: { name: string; email: string; image?: string };
  role: string;
}

export interface PackageInfo {
  package: {
    domain: string;
    name: string;
    description?: string;
    classification?: string;
  };
  versions: Array<{
    version: string;
    publishedAt: string;
    size: number;
    checksum: string;
    memberCount: number;
    guideCount: number;
  }>;
}

export interface VersionInfo {
  package: {
    domain: string;
    name: string;
    description?: string;
    classification?: string;
  };
  version: {
    version: string;
    publishedAt: string;
    size: number;
    checksum: string;
    memberCount: number;
    guideCount: number;
  };
  downloadUrl?: string;
}

export class RegistryClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  /** Request a device code for CLI login */
  async requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
    const res = await this.fetch("/api/auth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!res.ok) {
      throw new NetworkError(`Device code request failed (${res.status})`, `${this.baseUrl}/api/auth/device/code`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      deviceCode: (data.device_code ?? data.deviceCode) as string,
      userCode: (data.user_code ?? data.userCode) as string,
      verificationUri: (data.verification_uri ?? data.verificationUri) as string,
      verificationUriComplete: (data.verification_uri_complete ?? data.verificationUriComplete) as string | undefined,
      expiresIn: (data.expires_in ?? data.expiresIn) as number,
      interval: data.interval as number,
    };
  }

  /** Poll for device token completion */
  async pollDeviceToken(deviceCode: string, clientId: string): Promise<DeviceTokenResult> {
    const res = await this.fetch("/api/auth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode, client_id: clientId, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const error = data?.error;
      if (error === "authorization_pending") return { status: "pending" };
      if (error === "expired_token") return { status: "expired" };
      throw new NetworkError(`Device token poll failed (${res.status})`, `${this.baseUrl}/api/auth/device/token`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return { status: "success", token: (data.token ?? data.access_token ?? data.accessToken) as string };
  }

  /** Get current session info (requires token) */
  async getSession(): Promise<SessionInfo | null> {
    const res = await this.fetch("/api/auth/get-session", { method: "GET" });
    if (res.status === 401) return null;
    if (!res.ok) {
      throw new NetworkError(`Session check failed (${res.status})`, `${this.baseUrl}/api/auth/get-session`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (!data?.user) return null;
    return data as unknown as SessionInfo;
  }

  /** Get current user info + role */
  async getMe(): Promise<MeResponse | null> {
    const res = await this.fetch("/me", { method: "GET" });
    if (res.status === 401) return null;
    if (!res.ok) {
      throw new NetworkError(`Me request failed (${res.status})`, `${this.baseUrl}/me`);
    }
    return (await res.json()) as MeResponse;
  }

  /** Get package info (all versions) */
  async getPackage(fullName: string): Promise<PackageInfo> {
    const { domain, name } = splitDomainName(fullName);
    const res = await this.fetch(`/packages/${encodeURIComponent(domain)}/${encodeURIComponent(name)}`, { method: "GET" });
    this.handleErrorStatus(res);
    return (await res.json()) as PackageInfo;
  }

  /** Get specific package version */
  async getVersion(fullName: string, version: string): Promise<VersionInfo> {
    const { domain, name } = splitDomainName(fullName);
    const res = await this.fetch(`/packages/${encodeURIComponent(domain)}/${encodeURIComponent(name)}@${encodeURIComponent(version)}`, {
      method: "GET",
    });
    this.handleErrorStatus(res);
    return (await res.json()) as VersionInfo;
  }

  /** Download a file from a presigned URL (no auth needed) */
  async downloadFile(url: string): Promise<ArrayBuffer> {
    const res = await this.rawFetch(url);
    if (!res.ok) {
      throw new NetworkError(`Download failed (${res.status})`, url);
    }
    return res.arrayBuffer();
  }

  private handleErrorStatus(res: Response): void {
    if (res.ok) return;
    if (res.status === 401) throw new RegistryAuthError();
    if (res.status === 403) throw new RegistryForbiddenError();
    if (res.status === 429) throw new RegistryRateLimitError();
    if (res.status === 404) {
      throw new NetworkError(`Not found (404)`, res.url);
    }
    throw new NetworkError(`Registry error (${res.status})`, res.url);
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    try {
      return await this.rawFetch(url, { ...init, headers });
    } catch (err) {
      if (err instanceof RegistryAuthError || err instanceof RegistryForbiddenError || err instanceof RegistryRateLimitError || err instanceof NetworkError) {
        throw err;
      }
      throw new NetworkError(`Failed to connect to registry`, url);
    }
  }

  private rawFetch(url: string, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(url, init);
  }
}
