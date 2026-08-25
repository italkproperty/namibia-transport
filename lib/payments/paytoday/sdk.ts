import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";

import { getPayTodayConfig, type PayTodayConfig } from "./config";
import type {
  CreateIntentInput,
  CreateIntentResponse,
  QueryIntentResponse,
} from "./types";

/**
 * Runs PayToday's browser SDK on the server.
 *
 * PayToday ships one integration surface — a `<script>` tag that defines a
 * global `PayToday` — and publishes no REST specification for the two calls we
 * need. Their own security guidance forbids putting the private key in the
 * browser, so the only implementation that is both supported and safe is to
 * evaluate that script inside a Node VM and drive it from server code. The key
 * never leaves the server, and the traveller only ever sees the hosted
 * `payment_url` they get redirected to.
 *
 * Executing a remote script in the payment path is a supply-chain risk, so two
 * escape hatches exist: PAYTODAY_SDK_PATH vendors the file into the repo/image,
 * and PAYTODAY_SDK_SHA256 pins its digest and refuses to run anything else.
 * Set at least one before taking real money.
 */

type SdkInstance = {
  initialize(): Promise<boolean>;
  createPaymentIntent(input: CreateIntentInput): Promise<CreateIntentResponse>;
  queryPaymentIntent(token: string): Promise<QueryIntentResponse>;
};

type SdkConstructor = new (options: {
  shopKey: string;
  shopHandle: string;
  privateKey: string;
  environment: string;
}) => SdkInstance;

/**
 * Access tokens issued to the SDK are short-lived (the Business Portal
 * reference gives 1800s). Re-initialise well inside that window rather than
 * discovering the expiry as a failed payment.
 */
const SESSION_TTL_MS = 20 * 60 * 1000;

const globalForSdk = globalThis as unknown as {
  __payTodaySource?: Promise<string>;
  __payTodayCtor?: Promise<SdkConstructor>;
  __payTodaySession?: { instance: SdkInstance; createdAt: number };
};

async function loadSource(config: PayTodayConfig): Promise<string> {
  if (config.sdkPath) {
    return readFile(config.sdkPath, "utf8");
  }

  const response = await fetch(config.sdkUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Could not download the PayToday SDK (HTTP ${response.status}) from ${config.sdkUrl}`
    );
  }
  return response.text();
}

async function getSource(config: PayTodayConfig): Promise<string> {
  globalForSdk.__payTodaySource ??= loadSource(config).then((source) => {
    if (config.sdkSha256) {
      const digest = createHash("sha256").update(source, "utf8").digest("hex");
      if (digest !== config.sdkSha256) {
        throw new Error(
          `PayToday SDK digest mismatch: expected ${config.sdkSha256}, got ${digest}. ` +
            "Refusing to run it. Verify the change, then update PAYTODAY_SDK_SHA256."
        );
      }
    }
    return source;
  });

  try {
    return await globalForSdk.__payTodaySource;
  } catch (error) {
    // Do not cache a failure — a transient network blip would otherwise wedge
    // payments until the process restarts.
    globalForSdk.__payTodaySource = undefined;
    throw error;
  }
}

/**
 * Minimal shim of the globals a browser script expects. Deliberately small:
 * anything the SDK reaches for that is not here should fail loudly rather than
 * silently behave differently from a real browser.
 */
function buildSandbox(): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {
    console,
    fetch,
    Headers,
    Request,
    Response,
    FormData,
    URL,
    URLSearchParams,
    AbortController,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    btoa,
    atob,
    crypto,
    // UMD detection: a browser script that finds CommonJS present exports into
    // it, so give it one and read the result back.
    module: { exports: {} as Record<string, unknown> },
    exports: {} as Record<string, unknown>,
    // Some SDKs reach for axios rather than fetch; PayToday's React guide tells
    // integrators to `npm install axios`, which hints that it might. This is a
    // compatibility shim over fetch covering the surface such a script uses.
    axios: makeAxiosShim(),
    // A document stub: enough to not crash on a defensive touch, not enough to
    // pretend a DOM exists.
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      getElementsByTagName: () => [],
      addEventListener() {},
      removeEventListener() {},
      body: { appendChild() {}, removeChild() {} },
      head: { appendChild() {}, removeChild() {} },
    },
    location: { href: "", origin: "", search: "" },
    navigator: { userAgent: "namibia-transport/server" },
    localStorage: makeMemoryStorage(),
    sessionStorage: makeMemoryStorage(),
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function makeMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
}

type AxiosConfig = {
  url?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
  baseURL?: string;
  params?: Record<string, string>;
};

/** Faithful on the parts an SDK depends on: response shape and thrown errors. */
function makeAxiosShim() {
  async function request(config: AxiosConfig) {
    const base = config.baseURL ? new URL(config.url ?? "", config.baseURL) : new URL(config.url ?? "");
    if (config.params) {
      for (const [key, value] of Object.entries(config.params)) {
        base.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { ...(config.headers ?? {}) };
    const hasBody = config.data !== undefined && config.data !== null;
    const isPlainBody = hasBody && typeof config.data === "object" && !(config.data instanceof FormData);
    if (isPlainBody && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(base.toString(), {
      method: (config.method ?? "get").toUpperCase(),
      headers,
      body: hasBody ? (isPlainBody ? JSON.stringify(config.data) : (config.data as BodyInit)) : undefined,
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* leave as text */
    }

    const result = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config,
    };

    if (!response.ok) {
      const error = new Error(
        `Request failed with status code ${response.status}`
      ) as Error & { response?: unknown; config?: unknown; isAxiosError?: boolean };
      error.response = result;
      error.config = config;
      error.isAxiosError = true;
      throw error;
    }

    return result;
  }

  const axios = Object.assign(
    (config: AxiosConfig | string) =>
      request(typeof config === "string" ? { url: config } : config),
    {
      request,
      get: (url: string, config: AxiosConfig = {}) => request({ ...config, url, method: "get" }),
      delete: (url: string, config: AxiosConfig = {}) => request({ ...config, url, method: "delete" }),
      post: (url: string, data?: unknown, config: AxiosConfig = {}) =>
        request({ ...config, url, data, method: "post" }),
      put: (url: string, data?: unknown, config: AxiosConfig = {}) =>
        request({ ...config, url, data, method: "put" }),
      patch: (url: string, data?: unknown, config: AxiosConfig = {}) =>
        request({ ...config, url, data, method: "patch" }),
      create: () => axios,
      defaults: { headers: { common: {} as Record<string, string> } },
      interceptors: {
        request: { use: () => 0, eject: () => {} },
        response: { use: () => 0, eject: () => {} },
      },
    }
  );

  return axios;
}

async function loadConstructor(config: PayTodayConfig): Promise<SdkConstructor> {
  const source = await getSource(config);
  const sandbox = buildSandbox();
  const context = createContext(sandbox);

  runInContext(source, context, {
    filename: config.sdkPath ?? config.sdkUrl,
    timeout: 10_000,
  });

  const moduleExports = (sandbox.module as { exports?: Record<string, unknown> })
    .exports;

  const candidate =
    (sandbox.PayToday as unknown) ??
    moduleExports?.PayToday ??
    (typeof moduleExports === "function" ? moduleExports : undefined) ??
    (moduleExports?.default as unknown);

  if (typeof candidate !== "function") {
    throw new Error(
      "The PayToday SDK loaded but did not expose a PayToday constructor. " +
        "The script at " +
        (config.sdkPath ?? config.sdkUrl) +
        " may have changed shape."
    );
  }

  return candidate as SdkConstructor;
}

/** An initialised SDK instance, reused until its session is close to expiry. */
export async function getPayTodaySdk(): Promise<SdkInstance> {
  const config = getPayTodayConfig();
  if (!config) {
    throw new Error(
      "PayToday is not configured — set PAYTODAY_SHOP_KEY, PAYTODAY_SHOP_HANDLE and PAYTODAY_PRIVATE_KEY."
    );
  }

  const session = globalForSdk.__payTodaySession;
  if (session && Date.now() - session.createdAt < SESSION_TTL_MS) {
    return session.instance;
  }

  globalForSdk.__payTodayCtor ??= loadConstructor(config);

  let PayToday: SdkConstructor;
  try {
    PayToday = await globalForSdk.__payTodayCtor;
  } catch (error) {
    globalForSdk.__payTodayCtor = undefined;
    throw error;
  }

  const instance = new PayToday({
    shopKey: config.shopKey,
    shopHandle: config.shopHandle,
    privateKey: config.privateKey,
    environment: config.environment,
  });

  const initialised = await instance.initialize();
  if (!initialised) {
    throw new Error(
      "PayToday rejected the credentials during initialize(). Check the shop key, shop handle and private key."
    );
  }

  globalForSdk.__payTodaySession = { instance, createdAt: Date.now() };
  return instance;
}

/** Drops the cached session and source; the next call reloads from scratch. */
export function resetPayTodaySdk(): void {
  globalForSdk.__payTodaySession = undefined;
  globalForSdk.__payTodayCtor = undefined;
  globalForSdk.__payTodaySource = undefined;
}
