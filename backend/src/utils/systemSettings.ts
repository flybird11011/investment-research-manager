import { create, findAll, update } from '../db/jsonDb';

function getSettingRecord(key: string): any | undefined {
  return findAll<any>('systemSettings').find((item: any) => item.key === key);
}

export function getSystemSettingBoolean(key: string, defaultValue: boolean): boolean {
  const record = getSettingRecord(key);
  if (!record) return defaultValue;
  return record.value === true || record.value === 'true' || record.value === 1;
}

export function setSystemSettingBoolean(key: string, value: boolean): void {
  const record = getSettingRecord(key);
  if (record) {
    update('systemSettings', record.id, { value } as any);
    return;
  }

  create('systemSettings', {
    key,
    value,
  });
}
