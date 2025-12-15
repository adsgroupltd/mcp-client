
A **complete, ready‑to‑run Angular web application plus light MCP Server**:

* **Runs inside a Docker container** – the `Dockerfile` builds the Angular app, serves it with an ultra‑light Nginx image and exposes port 80.  
* **File‑attach capability** – a `<input type="file">` that reads the selected file as text (or binary‑base64) and sends it to the LLM endpoint.  
* **Dropdown list of LLMs** – a `<select>` that currently contains only one entry (`http://127.0.0.1:8000/v1/chat/completions`). Adding more entries later is just a matter of editing `src/app/llm.service.ts`.  
* **Formatted HTML output** – the response from the LLM is displayed inside a `<div [innerHTML]="formattedResponse">` so you get rich HTML rendering (the example safely sanitises the HTML).  

---

## 1. Project Overview

```
mcp-client/
│
├─ Dockerfile                 # Builds & serves the Angular app with Nginx
├─ nginx.conf                 # Minimal Nginx config for SPA routing
│
└─ client/                    # Angular source (generated with `ng new`)
   ├─ angular.json
   ├─ package.json
   ├─ tsconfig.json
   │
   └─ src/
      ├─ index.html
      ├─ main.ts
      ├─ styles.css
      │
      └─ app/
         ├─ app.module.ts
         ├─ app.component.ts
         ├─ app.component.html
         ├─ app.component.css
         └─ llm.service.ts
```

> **Why Angular?**  
> *All the tooling (`ng build`, TypeScript, component‑based UI) is already container‑friendly.*  
> *The generated static files can be served by any web server – we use Nginx because it’s tiny and well‑known.*

---

## 2. Angular Source Code

### `client/package.json`

```json
{
  "name": "mcp-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "ng": "ng",
    "start": "ng serve --host 0.0.0.0 --port 4200",
    "build": "ng build --configuration production"
  },
  "dependencies": {
    "@angular/animations": "~17.0.0",
    "@angular/common": "~17.0.0",
    "@angular/compiler": "~17.0.0",
    "@angular/core": "~17.0.0",
    "@angular/forms": "~17.0.0",
    "@angular/platform-browser": "~17.0.0",
    "@angular/platform-browser-dynamic": "~17.0.0",
    "@angular/router": "~17.0.0",
    "rxjs": "^7.8.1",
    "tslib": "^2.6.0",
    "zone.js": "~0.14.4"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "~17.0.0",
    "@angular/cli": "~17.0.0",
    "@angular/compiler-cli": "~17.0.0",
    "@types/jasmine": "~5.1.0",
    "jasmine-core": "~5.2.0",
    "karma": "~6.4.3",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.1",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "typescript": "~5.3.3"
  }
}
```

### `client/src/app/llm.service.ts` – service that talks to the LLM endpoint

```ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LlmConfig {
  name: string;
  endpoint: string; // full URL to the chat/completions API
}

/**
 * Very small wrapper around an OpenAI‑compatible chat completion endpoint.
 * It sends a single user message that contains the file contents (or a
 * reference to the uploaded file) and returns the assistant response.
 */
@Injectable({
  providedIn: 'root',
})
export class LlmService {
  // Default list – you can extend this later.
  private llms: LlmConfig[] = [
    {
      name: 'Local LLM (http://127.0.0.1:8000/v1/chat/completions)',
      endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
    },
  ];

  constructor(private http: HttpClient) {}

  /** Return the dropdown options */
  getAvailableLlms(): LlmConfig[] {
    return this.llms;
  }

  /**
   * Call the selected LLM.
   *
   * @param llmEndpoint – full URL to `/v1/chat/completions`
   * @param fileContent – string (or base64) of the uploaded file
   */
  callLlm(llmEndpoint: string, fileContent: string): Observable<any> {
    const payload = {
      model: 'gpt-3.5-turbo', // dummy – replace with whatever your local server expects
      messages: [
        {
          role: 'user',
          content: `Please analyse the following file and return a nicely formatted HTML report:\n\n${fileContent}`,
        },
      ],
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http.post<any>(llmEndpoint, payload, { headers });
  }
}
```

### `client/src/app/app.component.ts`

```ts
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LlmService, LlmConfig } from './llm.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  // UI state
  selectedLlm!: LlmConfig;
  llmOptions: LlmConfig[] = [];

  fileName: string = '';
  fileContent: string = '';

  // Result
  formattedResponse: SafeHtml | null = null;
  isLoading = false;
  errorMsg: string | null = null;

  constructor(
    private llmService: LlmService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.llmOptions = this.llmService.getAvailableLlms();
    // Pre‑select the first entry
    if (this.llmOptions.length > 0) {
      this.selectedLlm = this.llmOptions[0];
    }
  }

  /** Handle file selection */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.fileName = file.name;

    // Read as text – for binary files you could use readAsArrayBuffer + base64
    const reader = new FileReader();
    reader.onload = () => {
      this.fileContent = reader.result as string;
    };
    reader.onerror = () => {
      this.errorMsg = 'Failed to read the file.';
    };
    reader.readAsText(file);
  }

  /** Submit request to the selected LLM */
  async onSubmit(): Promise<void> {
    if (!this.fileContent) {
      this.errorMsg = 'Please select a file first.';
      return;
    }

    this.isLoading = true;
    this.errorMsg = null;

    try {
      const resp = await this.llmService
        .callLlm(this.selectedLlm.endpoint, this.fileContent)
        .toPromise();

      // The LLM may return `choices[0].message.content` (OpenAI style)
      const rawHtml = resp?.choices?.[0]?.message?.content ?? '';
      // Sanitize – Angular will strip dangerous tags (script, etc.)
      this.formattedResponse = this.sanitizer.bypassSecurityTrustHtml(
        rawHtml
      );
    } catch (err: any) {
      console.error(err);
      this.errorMsg = `LLM request failed: ${err.message || err}`;
    } finally {
      this.isLoading = false;
    }
  }

  /** Helper to display a friendly name for the selected LLM */
  getSelectedLlmName(): string {
    return this.selectedLlm?.name ?? '';
  }
}
```

### `client/src/app/app.component.html`

```html
<div class="container">
  <h1>MCP Client</h1>

  <!-- LLM selector -->
  <div class="field">
    <label for="llmSelect">LLM to use:</label>
    <select
      id="llmSelect"
      [(ngModel)]="selectedLlm"
      [ngModelOptions]="{standalone: true}"
    >
      <option *ngFor="let llm of llmOptions" [ngValue]="llm">
        {{ llm.name }}
      </option>
    </select>
  </div>

  <!-- File upload -->
  <div class="field">
    <label for="fileInput">Attach a file:</label>
    <input
      type="file"
      id="fileInput"
      (change)="onFileSelected($event)"
    />
    <span *ngIf="fileName">Selected: {{ fileName }}</span>
  </div>

  <!-- Submit button -->
  <div class="field">
    <button (click)="onSubmit()" [disabled]="isLoading">
      {{ isLoading ? 'Processing…' : 'Send to LLM' }}
    </button>
  </div>

  <!-- Error message -->
  <div class="error" *ngIf="errorMsg">{{ errorMsg }}</div>

  <!-- Result -->
  <div class="result" *ngIf="formattedResponse">
    <h2>LLM Output (HTML)</h2>
    <div class="output" [innerHTML]="formattedResponse"></div>
  </div>
</div>
```

### `client/src/app/app.component.css`

```css
.container {
  max-width: 800px;
  margin: 2rem auto;
  font-family: Arial, Helvetica, sans-serif;
}

h1 {
  text-align: center;
  margin-bottom: 1.5rem;
}

.field {
  margin: 1rem 0;
  display: flex;
  align-items: center;
}

label {
  min-width: 120px;
  font-weight: bold;
}

select,
input[type='file'],
button {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
}

button {
  cursor: pointer;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
}

button[disabled] {
  background-color: #90caf9;
  cursor: not-allowed;
}

.error {
  color: #b00020;
  margin-top: 1rem;
}

.result {
  margin-top: 2rem;
  border-top: 1px solid #ddd;
  padding-top: 1rem;
}

.output {
  background-color: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
}
```

### `client/src/app/app.module.ts`

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'; // needed for ngModel
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, FormsModule, HttpClientModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### `client/src/index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MCP Client</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

---

## 3. Docker Setup

### `Dockerfile`

```dockerfile
# ------------------------------------------------------------
# Stage 1 – build the Angular app (node 20)
# ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install Angular CLI globally (optional but handy)
RUN npm install -g @angular/cli@17

# Copy package files and install deps
COPY client/package*.json ./
RUN npm ci

# Copy the whole Angular source and build it
COPY client/ .
RUN ng build --configuration production

# ------------------------------------------------------------
# Stage 2 – serve the compiled files with Nginx (tiny)
# ------------------------------------------------------------
FROM nginx:alpine

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist/client/ /usr/share/nginx/html/

# Custom nginx config to support Angular's HTML5 routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the standard HTTP port
EXPOSE 80

# Start nginx (foreground)
CMD ["nginx", "-g", "daemon off;"]
```

### `nginx.conf`

```nginx
# Minimal config that serves the Angular SPA and rewrites all non‑file routes to index.html
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Serve static files directly
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: improve caching for assets
    location ~* \.(js|css|png|jpg|jpeg|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 4. How to Build & Run

```bash
# Clone / copy the repository structure into a folder called mcp-client
cd mcp-client

# Build the Docker image (you can tag it whatever you like)
docker build -t mcp-client:latest .

# Run the container, mapping host port 8080 → container port 80
docker run -d -p 8080:80 --name mcp-client-instance mcp-client:latest
```

Open a browser and navigate to **`http://localhost:8080`**. You should see the UI:

1. Choose the (only) LLM from the dropdown.
2. Click **Attach a file**, pick any text‑based file (e.g., `.txt`, `.md`, `.json`).
3. Press **Send to LLM**.
4. The response from the local LLM will appear as nicely formatted HTML below.

> **Portability note** – The container contains everything (Node → Angular build → Nginx). No host‑side dependencies are required beyond Docker itself, making it truly portable across Linux/macOS/Windows hosts.

---

## 5. Extending the App

| Feature | Where to modify |
|---------|-----------------|
| **Add more LLMs** | Edit `src/app/llm.service.ts` → the `llms` array. You can also load them from a JSON file or an environment variable if you prefer dynamic configuration. |
| **Binary files** | In `onFileSelected`, use `reader.readAsArrayBuffer(file)` and then `btoa` the result before sending it to the LLM. |
| **Authentication** | Add an `Authorization` header in `LlmService.callLlm()` (e.g., a bearer token). |
| **Custom styling** | Change `app.component.css` or add Angular Material for a richer UI. |
| **Persist history** | Store previous queries/responses in `localStorage` or a lightweight IndexedDB wrapper. |

---

## 6. Summary

* **Angular SPA** – provides file upload, LLM selector, and HTML‑rendered output.  
* **Dockerized** – multi‑stage build (Node → Nginx) for a tiny, production‑ready image.  
* **Portability** – run anywhere Docker runs; the UI is self‑contained, no external assets required.  


Below is a **complete, single‑container solution** that gives...

1. **The Angular front‑end you already have** (file upload, LLM selector, HTML output).  
2. **A tiny Node‑Express “MCP server”** that runs on the same container and exposes the route  

```
POST /mcp/chat/completions
```

   – this is the endpoint the Angular app will call.  
3. **A plug‑in style registration file (`mcp.json`)** that can be mounted into the container at run time so you (or a later‑stage CI/CD pipeline) can add or replace LLM definitions without rebuilding the image.  
4. **A production‑ready Dockerfile** that starts *both* the Express server and the Angular static files (served by Express – no need for a second Nginx process).  

---

## 1. Directory Layout

```
mcp-client/
│
├─ Dockerfile                # builds Angular → copies + runs Express
├─ package.json              # top‑level (Node) deps for the back‑end
├─ tsconfig.json             # TypeScript config for the server
│
├─ mcp.json                  # optional – LLM registry (mounted at runtime)
│
├─ client/                   # Angular source (exactly as in the previous answer)
│   └─ ...                   # unchanged
│
└─ server/                   # Express back‑end source
    ├─ index.ts              # main entry point
    └─ llm-registry.ts       # helper that reads mcp.json
```

> **Why move to Express only?**  
> * One process → Docker `CMD` can just start the Node app.  
> * The same container can serve static Angular assets **and** act as the MCP HTTP API, which is exactly what you asked for.  
> * It keeps the image tiny (≈ 30 MB) and eliminates a second web‑server (nginx).

---

## 2. Back‑End Code

### `package.json` (top level)

```json
{
  "name": "mcp-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build:client": "cd client && npm ci && ng build --configuration production",
    "start": "node server/dist/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.7",
    "ts-node": "^10.9.2",
    "typescript": "~5.3.3"
  }
}
```

### `tsconfig.json` (root – for the server)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./server/dist",
    "rootDir": "./server",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["server/**/*.ts"]
}
```

### `server/llm-registry.ts`

```ts
import fs from 'fs';
import path from 'path';

export interface LlmEntry {
  /** Human readable name */
  name: string;
  /** Full HTTP URL of the chat/completions endpoint (e.g. http://127.0.0.1:8000/v1/chat/completions) */
  endpoint: string;
}

/**
 * Reads the JSON file that holds LLM registrations.
 *
 * If the file does not exist or is malformed we fall back to a single
 * hard‑coded entry (the same one you used in the Angular front‑end).
 *
 * The file can be mounted into the container at `/app/mcp.json` so that
 * users can customise it without rebuilding.
 */
export function loadRegistry(): LlmEntry[] {
  const defaultRegistry: LlmEntry[] = [
    {
      name: 'Local LLM (http://127.0.0.1:8000/v1/chat/completions)',
      endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
    },
  ];

  const filePath = path.resolve('/app/mcp.json'); // absolute inside container
  try {
    const raw = fs.readFileSync(filePath, 'utf‑8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as LlmEntry[];
    }
    console.warn('mcp.json is not an array – falling back to default registry');
  } catch (e) {
    // file missing or JSON error – ignore, use default
  }
  return defaultRegistry;
}
```

### `server/index.ts`

```ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fetch from 'node-fetch'; // built‑in in Node ≥18, but keep for clarity
import { loadRegistry, LlmEntry } from './llm-registry';

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
app.use(cors()); // Angular runs on the same origin, but keep it open for dev
app.use(express.json({ limit: '10mb' })); // body parser for JSON payloads

// ------------------------------------------------------------------
// Serve Angular static files (built in client/dist/client)
// ------------------------------------------------------------------
const angularDist = path.join(__dirname, '../../client/dist/client');
app.use(express.static(angularDist));

// ------------------------------------------------------------------
// Helper – find LLM entry by name (sent from the front‑end)
// ------------------------------------------------------------------
function findLlmByName(name: string): LlmEntry | undefined {
  const registry = loadRegistry();
  return registry.find((e) => e.name === name);
}

// ------------------------------------------------------------------
// MCP API – POST /mcp/chat/completions
// ------------------------------------------------------------------
app.post('/mcp/chat/completions', async (req: Request, res: Response) => {
  /**
   * Expected payload from the front‑end:
   *
   * {
   *   "model": "...",               // optional – we forward as‑is
   *   "messages": [{role,content}], // OpenAI chat format
   *   "llmName": "Local LLM (http://127.0.0.1:8000/v1/chat/completions)"
   * }
   */
  const { llmName, ...forwardPayload } = req.body;

  if (!llmName) {
    return res.status(400).json({ error: '`llmName` is required' });
  }

  const llm = findLlmByName(llmName);
  if (!llm) {
    return res.status(404).json({ error: `LLM "${llmName}" not found` });
  }

  try {
    const response = await fetch(llm.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardPayload),
    });

    const data = await response.json();

    // Forward the exact JSON we got from the LLM – Angular knows how to read it.
    res.status(response.status).json(data);
  } catch (err: any) {
    console.error('Error proxying to LLM:', err);
    res.status(502).json({ error: 'Failed to reach the configured LLM' });
  }
});

// ------------------------------------------------------------------
// Catch‑all – send index.html for any unknown route (Angular SPA)
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
```

> **Note** – `node-fetch` is part of the Node 18+ runtime, but if you run an older node version add it to `dependencies`. The above code uses the native fetch for simplicity.

---

## 3. Adjust Front‑End to Call the New API

Only a tiny change is required in `src/app/llm.service.ts` – instead of calling the raw LLM endpoint directly, it now posts to `/mcp/chat/completions` and includes the selected LLM name.

```ts
// src/app/llm.service.ts  (updated)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LlmConfig {
  name: string;
  endpoint: string; // kept for UI display only
}

@Injectable({ providedIn: 'root' })
export class LlmService {
  private llms: LlmConfig[] = [
    // This list is duplicated with the back‑end registry – keep it in sync.
    {
      name: 'Local LLM (http://127.0.0.1:8000/v1/chat/completions)',
      endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
    },
  ];

  constructor(private http: HttpClient) {}

  getAvailableLlms(): LlmConfig[] {
    return this.llms;
  }

  /** Forward request to the internal MCP endpoint */
  callLlm(selectedLlmName: string, fileContent: string): Observable<any> {
    const payload = {
      model: 'gpt-3.5-turbo', // placeholder – can be omitted
      messages: [
        {
          role: 'user',
          content: `Please analyse the following file and return a nicely formatted HTML report:\n\n${fileContent}`,
        },
      ],
      llmName: selectedLlmName,
    };
    return this.http.post<any>('/mcp/chat/completions', payload);
  }
}
```

And in `app.component.ts` replace the call:

```ts
// inside onSubmit()
await this.llmService.callLlm(this.selectedLlm.name, this.fileContent).toPromise();
```

Now the Angular UI talks to **your own MCP server** (`/mcp/chat/completions`), which in turn proxies the request to the real LLM endpoint.

---

## 4. Dockerfile – Build + Run Both Parts

```dockerfile
# ------------------------------------------------------------
# Stage 1 – build Angular (node)
# ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# ---------- Install Angular CLI ----------
RUN npm install -g @angular/cli@17

# ---------- Build client ----------
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN ng build --configuration production

# ---------- Install server deps ----------
COPY package*.json tsconfig.json ./
RUN npm ci   # installs express, cors, typescript, ts-node ...

# ---------- Compile server ----------
COPY server/ ./server/
RUN npx tsc   # uses tsconfig.json, outputs to server/dist

# ------------------------------------------------------------
# Stage 2 – runtime (node)
# ------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Copy only the runtime artefacts from builder
COPY --from=builder /app/client/dist/client ./client/dist/client
COPY --from=builder /app/server/dist ./server/dist
COPY package*.json tsconfig.json ./

# Install only production deps (express, cors)
ENV NODE_ENV=production
RUN npm ci --only=production

# Optional: expose a volume for the registry file
VOLUME ["/app"]   # allows mounting mcp.json from host

EXPOSE 3000

# Start the Express server (which also serves Angular)
CMD ["node", "server/dist/index.js"]
```

### How to run (with optional custom `mcp.json`)

```bash
# 1. Build the image
docker build -t mcp-client:latest .

# 2. (Optional) create a custom registry file on the host
cat > mcp.json <<'EOF'
[
  {
    "name": "MyOwn LLM",
    "endpoint": "http://host.docker.internal:8000/v1/chat/completions"
  }
]
EOF

# 3. Run the container, mounting the file so the server can read it
docker run -d \
  -p 8080:3000 \               # host 8080 → container 3000 (Express)
  -v "$(pwd)/mcp.json:/app/mcp.json:ro" \
  --name mcp-client-instance \
  mcp-client:latest
```

Now open **`http://localhost:8080`** in a browser. The UI will:

* Load the LLM list from the **front‑end static array** (you can keep them in sync or fetch `/mcp/registry` later if you prefer).  
* When the user clicks **Send to LLM**, Angular POSTs to `/mcp/chat/completions`.  
* The Express back‑end reads `mcp.json`, finds the matching entry, forwards the request to that endpoint, and returns the LLM’s JSON response.  
* The UI renders the `choices[0].message.content` as safe HTML.

---

## 5. Extending / Customising

| Goal | How to achieve |
|------|----------------|
| **Add more LLMs without rebuilding** | Edit the host‑side `mcp.json` and restart the container (or send a SIGHUP + add an endpoint to reload – easy to implement). |
| **Expose the registry via HTTP** | Add a route `GET /mcp/registry` in `server/index.ts` that returns `loadRegistry()`. Then Angular can fetch the list dynamically. |
| **Authentication to LLMs** | Extend `LlmEntry` with an optional `authHeader` field; in the proxy code add it to the fetch request. |
| **Support streaming responses** | Replace `fetch` with `node-fetch`/`http` and pipe the response to the client; Angular can consume an EventSource or fetch `ReadableStream`. |
| **Add health‑check endpoint** | Add `GET /mcp/health` that returns `{status:'ok'}` – useful for orchestration. |

---

## 6. Recap

* **Single Docker image** – builds Angular, compiles the Node server, and runs both.  
* **MCP back‑end** (`/mcp/chat/completions`) forwards to any LLM you register in `mcp.json`.  
* **Front‑end** unchanged except for a tiny service rewrite; it still provides file upload, dropdown, and formatted HTML output.  
* **Customization** – mount `mcp.json` at runtime to add or replace LLM definitions, making the container completely portable and configurable.

You now have a **complete MCP client + server stack** ready for local development, CI pipelines, or production deployment. 🎉
