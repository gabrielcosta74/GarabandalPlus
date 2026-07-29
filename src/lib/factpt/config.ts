import type {
  FactPtCredentialSlot,
  FactPtEnvironment,
  FactPtSeriesCode,
  FactPtSourceType,
} from './types';

export const FACTPT_SANDBOX_BASE_URL = 'http://api.sandbox.fact.pt';
export const FACTPT_PRODUCTION_BASE_URL = 'https://api.fact.pt';
export const FACTPT_DEFAULT_API_VERSION = '1.0.0';
export const FACTPT_DEFAULT_TIMEOUT_MS = 15_000;

export type FactPtConfig = {
  environment: FactPtEnvironment;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  timeoutMs: number;
  series: FactPtSeriesCode;
  credentialSlot: FactPtCredentialSlot;
};

type Environment = Record<string, string | undefined>;

const SOURCE_CONFIG: Record<
  FactPtSourceType,
  {
    series: FactPtSeriesCode;
    credentialSlot: FactPtCredentialSlot;
    sandboxApiKeyVariable: string;
    productionApiKeyVariable?: string;
  }
> = {
  quota: {
    series: '2026Q',
    credentialSlot: 'Q',
    sandboxApiKeyVariable: 'FACTPT_SANDBOX_KEY_2026Q',
  },
  store: {
    series: '2026L',
    credentialSlot: 'L',
    sandboxApiKeyVariable: 'FACTPT_SANDBOX_KEY_2026L',
  },
  donation: {
    series: '2026D',
    credentialSlot: 'D',
    sandboxApiKeyVariable: 'FACTPT_SANDBOX_KEY_2026D',
    productionApiKeyVariable: 'FACTPT_PRODUCTION_KEY_2026D',
  },
  pilgrimage: {
    series: '2026D',
    credentialSlot: 'D',
    sandboxApiKeyVariable: 'FACTPT_SANDBOX_KEY_2026D',
    productionApiKeyVariable: 'FACTPT_PRODUCTION_KEY_2026D',
  },
};

export function getFactPtSourceConfig(sourceType: FactPtSourceType) {
  return SOURCE_CONFIG[sourceType];
}

export function isFactPtProductionEnabled(
  env: Environment = process.env,
): boolean {
  return (
    env.FACTPT_PRODUCTION_ENABLED?.trim().toLowerCase() === 'true'
    || env.FACTPT_PRODUCTION_PILOT_ENABLED?.trim().toLowerCase() === 'true'
  );
}

/** @deprecated Compatibility alias for deployments still carrying the pilot variable. */
export const isFactPtProductionPilotEnabled = isFactPtProductionEnabled;

export function getFactPtUnitId(
  environment: FactPtEnvironment = 'sandbox',
  env: Environment = process.env,
): number {
  const variable =
    environment === 'production'
      ? 'FACTPT_PRODUCTION_UNIT_ID'
      : 'FACTPT_UNIT_ID';
  const rawUnitId = env[variable] || (environment === 'sandbox' ? '1' : '');
  const unitId = Number(rawUnitId);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    throw new Error(`${variable} tem de ser um inteiro positivo.`);
  }
  return unitId;
}

function assertNoPublicFactPtSecrets(env: Environment) {
  const leakedPublicKey = Object.entries(env).find(
    ([name, value]) => name.startsWith('NEXT_PUBLIC_FACTPT') && Boolean(value),
  );
  if (leakedPublicKey) {
    throw new Error(
      `Configuração FACT.pt insegura: remova a variável pública ${leakedPublicKey[0]}.`,
    );
  }
}

export function getFactPtConfig(
  sourceType: FactPtSourceType,
  environment: FactPtEnvironment,
  env: Environment = process.env,
): FactPtConfig {
  assertNoPublicFactPtSecrets(env);
  const sourceConfig = SOURCE_CONFIG[sourceType];
  if (
    environment === 'production'
    && sourceType !== 'pilgrimage'
    && sourceType !== 'donation'
  ) {
    throw new Error(
      'A FACT.pt de produção aceita exclusivamente peregrinações e doações diretas.',
    );
  }

  if (environment === 'production' && !isFactPtProductionEnabled(env)) {
    throw new Error(
      'A FACT.pt de produção está desativada no servidor.',
    );
  }

  const baseUrl =
    environment === 'production'
      ? FACTPT_PRODUCTION_BASE_URL
      : FACTPT_SANDBOX_BASE_URL;
  const configuredBaseUrl =
    environment === 'production'
      ? env.FACTPT_PRODUCTION_BASE_URL
      : env.FACTPT_BASE_URL;
  if (
    configuredBaseUrl
    && configuredBaseUrl.replace(/\/+$/, '') !== baseUrl
  ) {
    throw new Error(
      `O URL FACT.pt configurado não corresponde ao ambiente ${environment}.`,
    );
  }

  const apiKeyVariable =
    environment === 'production'
      ? sourceConfig.productionApiKeyVariable
      : sourceConfig.sandboxApiKeyVariable;
  if (!apiKeyVariable) {
    throw new Error(
      `A origem ${sourceType} não está autorizada em produção.`,
    );
  }
  const apiKey = env[apiKeyVariable]?.trim();
  if (!apiKey) {
    throw new Error(
      `FACT.pt ${environment} não configurado: falta ${apiKeyVariable}.`,
    );
  }

  const configuredTimeout = Number(env.FACTPT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : FACTPT_DEFAULT_TIMEOUT_MS;

  return {
    environment,
    baseUrl,
    apiKey,
    apiVersion: env.FACTPT_API_VERSION?.trim() || FACTPT_DEFAULT_API_VERSION,
    timeoutMs,
    series: sourceConfig.series,
    credentialSlot: sourceConfig.credentialSlot,
  };
}

export function getFactPtSandboxConfig(
  sourceType: FactPtSourceType,
  env: Environment = process.env,
): FactPtConfig {
  return getFactPtConfig(sourceType, 'sandbox', env);
}
