import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { ConfigYamlSchema, EnvSchema, type AppConfig, type EnvConfig } from './schema.js';

// Load .env
dotenv.config();

export interface LoadedConfig {
  env: EnvConfig;
  config: AppConfig;
  isDryRun: boolean;
}

let cachedConfig: LoadedConfig | null = null;

export function loadConfig(configPath = './config.yaml'): LoadedConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // 1. Validate Environment Variables
  const envParsed = EnvSchema.safeParse(process.env);
  if (!envParsed.success) {
    console.error('Invalid environment variables:', envParsed.error.format());
    throw new Error('Environment configuration validation failed');
  }
  const env = envParsed.data;

  // 2. Load & Validate config.yaml
  let rawYaml = '';
  const resolvedConfigPath = path.resolve(process.cwd(), configPath);
  if (fs.existsSync(resolvedConfigPath)) {
    rawYaml = fs.readFileSync(resolvedConfigPath, 'utf8');
  } else {
    console.warn(`[Config] Config file not found at ${resolvedConfigPath}. Using defaults.`);
  }

  const parsedYaml = rawYaml ? YAML.parse(rawYaml) : {};
  const configParsed = ConfigYamlSchema.safeParse(parsedYaml);
  if (!configParsed.success) {
    console.error('Invalid config.yaml structure:', configParsed.error.format());
    throw new Error('config.yaml validation failed');
  }
  const config = configParsed.data;

  // Ensure necessary runtime directories exist
  const dirsToEnsure = [
    config.app.dataDir,
    config.app.inboxDir,
    config.app.musicDir,
    config.app.outputDir,
    config.app.tempDir,
  ];

  for (const dir of dirsToEnsure) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // Dry run can be forced by env DRY_RUN=true or config.publishing.dryRun
  const isDryRun = Boolean(env.DRY_RUN || config.publishing.dryRun);

  cachedConfig = {
    env,
    config,
    isDryRun,
  };

  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
