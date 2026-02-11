import prisma from '../lib/prisma';
import { decryptJson, encryptJson } from '../lib/crypto/settingsCrypto';
import { logger } from '../utils/logger';

export type PlatformSettingRecord = {
  key: string;
  valueJson: any;
  isSecret: boolean;
  updatedById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const maskValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(maskValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        const lower = key.toLowerCase();
        if (['cert', 'secret', 'key', 'password'].some((token) => lower.includes(token))) {
          return [key, '***'];
        }
        return [key, maskValue(val)];
      })
    );
  }
  return value;
};

export const platformSettingsService = {
  async getSetting(key: string) {
    const setting = await prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) return null;

    if (!setting.isSecret) {
      return { ...setting, valueJson: setting.valueJson };
    }

    return {
      ...setting,
      valueJson: {
        ...(typeof setting.valueJson === 'object' ? setting.valueJson : {}),
        isConfigured: Boolean(setting.valueJson),
      },
    };
  },

  async getSettingDecrypted(key: string) {
    const setting = await prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) return null;

    if (!setting.isSecret) {
      return setting.valueJson;
    }

    try {
      return decryptJson(String(setting.valueJson));
    } catch (error) {
      logger.error('Erro ao descriptografar setting', { key, error: (error as Error).message });
      return null;
    }
  },

  async getMany(keys: string[]) {
    const settings = await prisma.platformSetting.findMany({
      where: { key: { in: keys } },
    });
    return settings.map((setting) => {
      if (!setting.isSecret) {
        return { ...setting, valueJson: setting.valueJson };
      }
      return {
        ...setting,
        valueJson: {
          ...(typeof setting.valueJson === 'object' ? setting.valueJson : {}),
          isConfigured: Boolean(setting.valueJson),
        },
      };
    });
  },

  async setSetting(
    key: string,
    valueJson: any,
    actorUserId: string,
    isSecret: boolean
  ) {
    const storedValue = isSecret ? encryptJson(valueJson) : valueJson;
    const setting = await prisma.platformSetting.upsert({
      where: { key },
      update: { valueJson: storedValue, isSecret, updatedById: actorUserId },
      create: { key, valueJson: storedValue, isSecret, updatedById: actorUserId },
    });
    return setting;
  },

  async setMany(
    payload: Array<{ key: string; valueJson: any; isSecret: boolean }>,
    actorUserId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of payload) {
        const storedValue = item.isSecret ? encryptJson(item.valueJson) : item.valueJson;
        const setting = await tx.platformSetting.upsert({
          where: { key: item.key },
          update: { valueJson: storedValue, isSecret: item.isSecret, updatedById: actorUserId },
          create: { key: item.key, valueJson: storedValue, isSecret: item.isSecret, updatedById: actorUserId },
        });
        results.push(setting);
      }
      return results;
    });
  },

  maskSecretsForResponse(valueJson: any): any {
    return maskValue(valueJson);
  },
};
