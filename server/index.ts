import express, { Request, Response } from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // native in Node >=18, kept for clarity
import { loadRegistry, LlmEntry } from './llm-registry';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ------------------------------------------------------------------
// Serve Angular static files (built in client/dist/client)
// ------------------------------------------------------------------
const angularDist = path.join(__dirname, '../../client/dist/client');
app.use(express.static(angularDist));

// ------------------------------------------------------------------
// Helper – find LLM by its displayed name
// ------------------------------------------------------------------
function findLlm(name: string): LlmEntry | undefined {
  const registry = loadRegistry();
  return registry.find((e) => e.name === name);
}

// ------------------------------------------------------------------
// MCP API – POST /mcp/chat/completions
// ------------------------------------------------------------------
app.post('/mcp/chat/completions', async (req: Request, res: Response) => {
  const { llmName, ...forwardPayload } = req.body;

  if (!llmName) {
    return res.status(400).json({ error: '`llmName` is required' });
  }

  const llm = findLlm(llmName);
  if (!llm) {
    return res.status(404).json({ error: `LLM "${llmName}" not found` });
  }

  try {
    const llmResponse = await fetch(llm.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardPayload),
    });

    const data = await llmResponse.json();
    res.status(llmResponse.status).json(data);
  } catch (err: any) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Failed to reach the configured LLM' });
  }
});

// ------------------------------------------------------------------
// Catch‑all – serve index.html for Angular routing
// ------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(angularDist, 'index.html'));
});

// ------------------------------------------------------------------
// Start server
// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 MCP server listening on http://0.0.0.0:${PORT}`);
  console.log('Loaded LLM registry:', loadRegistry());
});
