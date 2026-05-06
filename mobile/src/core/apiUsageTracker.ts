import type { ApiComponent, ApiUsageRecord } from './types';

const DEVICE_ID_KEY = 'device_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class ApiUsageTracker {
  private deviceId = '';
  private endpoint = '';
  private storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> } | null = null;

  /** Initialize with the telemetry endpoint + storage backend */
  async init(
    endpoint: string,
    storage: { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> },
  ): Promise<void> {
    this.endpoint = endpoint;
    this.storage = storage;

    // Get or create device ID
    this.deviceId = (await storage.get(DEVICE_ID_KEY)) || '';
    if (!this.deviceId) {
      this.deviceId = generateUUID();
      await storage.set(DEVICE_ID_KEY, this.deviceId);
    }
  }

  /** Record an API call: save locally + send to remote endpoint */
  async record(call: {
    model: string;
    component: ApiComponent;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }): Promise<void> {
    if (!this.deviceId) return;

    const record: ApiUsageRecord = {
      ...call,
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
    };

    // Save to local SQLite (backup)
    if (this.storage) {
      try {
        const { getDb } = await import('../db/database');
        const db = await getDb();
        await db.runAsync(
          `INSERT INTO api_usage (device_id, model, component, prompt_tokens, completion_tokens, total_tokens, synced)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          record.deviceId, record.model, record.component,
          record.promptTokens, record.completionTokens, record.totalTokens
        );
      } catch { /* local save is best-effort */ }
    }

    // Send to remote endpoint
    if (!this.endpoint) return;
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (response.ok) {
        // Mark last inserted row as synced (best-effort)
        try {
          const { getDb } = await import('../db/database');
          const db = await getDb();
          await db.runAsync(
            "UPDATE api_usage SET synced = 1 WHERE device_id = ? AND created_at = (SELECT MAX(created_at) FROM api_usage WHERE device_id = ? AND synced = 0)",
            record.deviceId, record.deviceId
          );
        } catch { /* ignore */ }
      }
    } catch { /* network error — data already saved locally */ }
  }
}

/** Singleton instance */
export const apiUsageTracker = new ApiUsageTracker();
