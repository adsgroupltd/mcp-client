import fs from 'fs';
import path from 'path';

export interface LlmEntry {
  name: string;
  endpoint: string;
}

/**
 * Reads `/app/mcp.json` (mounted or copied). If the file is missing
 * or malformed, returns a default single entry.
 */
export function loadRegistry(): LlmEntry[] {
  const defaultRegistry: LlmEntry[] = [
    {
      name: 'Local LLM (http://127.0.0.1:8000/v1/chat/completions)',
      endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
    },
  ];

  const filePath = path.resolve('/app/mcp.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as LlmEntry[];
    }
  } catch (_) {
    // ignore – fall back to default
  }
  return defaultRegistry;
}
