Below is **every source file** that you need to copy‑and‑paste into the project.  
The directory tree is shown first; then each file is presented **in its final, ready‑to‑build form**.  
All paths are relative to the root folder **`mcp-client/`**.

---

## 📂 Directory Tree

```
mcp-client/
│
├─ Dockerfile
├─ package.json                # top‑level (Node back‑end)
├─ tsconfig.json               # TypeScript config for the back‑end
│
├─ mcp.json                    # (optional) LLM registry – you can mount/replace it
│
├─ angular.json                # Angular workspace config
├─ tsconfig.app.json           # Angular app TS config
├─ tsconfig.base.json          # shared TS base for Angular
│
├─ client/                     # <-- Angular source (generated with ng new)
│   ├─ package.json
│   ├─ src/
│   │   ├─ index.html
│   │   ├─ main.ts
│   │   ├─ styles.css
│   │   └─ app/
│   │       ├─ app.module.ts
│   │       ├─ app.component.ts
│   │       ├─ app.component.html
│   │       └─ app.component.css
│   └─ ... (other Angular generated files – kept minimal)
│
└─ server/                     # <-- Express back‑end (TypeScript)
    ├─ llm-registry.ts
    └─ index.ts
```

> **All files are shown below in the exact order you should create them.**  
> After copying everything, run the two build commands (`npm run build:client` and `docker build …`) as described at the end.

---

## 1️⃣ Root Files

### `Dockerfile`

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

### `package.json` (root – back‑end)

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

### `tsconfig.json` (root – back‑end)

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

### `mcp.json` (optional – can be mounted/edited)

```json
[
  {
    "name": "Local LLM (http://127.0.0.1:8000/v1/chat/completions)",
    "endpoint": "http://127.0.0.1:8000/v1/chat/completions"
  }
]
```

---

## 2️⃣ Angular Workspace Files (root)

### `angular.json`

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "client": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/client",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": [],
            "tsConfig": "tsconfig.app.json",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.css"
            ],
            "scripts": []
          },
          "configurations": {
            "production": {
              "fileReplacements": [],
              "optimization": true,
              "outputHashing": "all",
              "sourceMap": false,
              "extractCss": true,
              "namedChunks": false,
              "aot": true,
              "extractLicenses": true,
              "vendorChunk": false,
              "buildOptimizer": true,
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "2mb",
                  "maximumError": "5mb"
                }
              ]
            },
            "development": {
              "buildOptions": {}
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "browserTarget": "client:build"
          },
          "configurations": {
            "production": {
              "browserTarget": "client:build:production"
            },
            "development": {
              "browserTarget": "client:build:development"
            }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  },
  "defaultProject": "client"
}
```

### `tsconfig.base.json`

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "sourceMap": true,
    "declaration": false,
    "downlevelIteration": true,
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "target": "ES2022",
    "module": "esnext",
    "lib": [
      "es2022",
      "dom"
    ]
  }
}
```

### `tsconfig.app.json`

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": [
    "src/main.ts",
    "src/polyfills.ts"
  ],
  "include": [
    "src/**/*.d.ts"
  ]
}
```

---

## 3️⃣ Angular Application (inside `client/`)

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

### `client/src/main.ts`

```ts
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from '../environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
```

### `client/src/styles.css` (global)

```css
/* You can keep this empty or add a global reset */
body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
}
```

#### `client/src/app/app.module.ts`

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'; // ngModel
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

#### `client/src/app/app.component.ts`

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

  fileName = '';
  fileContent = '';

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
    if (this.llmOptions.length > 0) {
      this.selectedLlm = this.llmOptions[0];
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      this.fileContent = reader.result as string;
    };
    reader.onerror = () => (this.errorMsg = 'Failed to read file');
    reader.readAsText(file);
  }

  async onSubmit(): Promise<void> {
    if (!this.fileContent) {
      this.errorMsg = 'Please select a file first.';
      return;
    }

    this.isLoading = true;
    this.errorMsg = null;

    try {
      const resp = await this.llmService
        .callLlm(this.selectedLlm.name, this.fileContent)
        .toPromise();

      const rawHtml = resp?.choices?.[0]?.message?.content ?? '';
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

  getSelectedLlmName(): string {
    return this.selectedLlm?.name ?? '';
  }
}
```

#### `client/src/app/app.component.html`

```html
<div class="container">
  <h1>MCP Client</h1>

  <!-- LLM selector -->
  <div class="field">
    <label for="llmSelect">LLM to use:</label>
    <select
      id="llmSelect"
      [(ngModel)]="selectedLlm"
      [ngModelOptions]="{ standalone: true }"
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

#### `client/src/app/app.component.css`

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

#### `client/src/app/llm.service.ts`

```ts
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
    {
      name: 'Local LLM (http://127.0.0.1:8000/v1/chat/completions)',
      endpoint: 'http://127.0.0.1:8000/v1/chat/completions',
    },
  ];

  constructor(private http: HttpClient) {}

  getAvailableLlms(): LlmConfig[] {
    return this.llms;
  }

  /** Calls the internal MCP API; forwards selected LLM name */
  callLlm(selectedLlmName: string, fileContent: string): Observable<any> {
    const payload = {
      model: 'gpt-3.5-turbo',
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

---

## 4️⃣ Express Back‑End (inside `server/`)

### `server/llm-registry.ts`

```ts
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
```

### `server/index.ts`

```ts
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
```

> **Note:** The back‑end uses the same default LLM entry as the front‑end. If you mount a custom `mcp.json` (see run command below) the back‑end will read it; the front‑end still shows the hard‑coded name, but you can easily change the Angular `llm.service.ts` to fetch `/mcp/registry` if you prefer full dynamism.

---

## 5️⃣ Build & Run Instructions

```bash
# -------------------------------------------------
# 1. Clone / create the folder structure as shown
# -------------------------------------------------
mkdir -p mcp-client && cd mcp-client
# (copy all files into the proper sub‑folders – see above)

# -------------------------------------------------
# 2. Build the Angular app (the Dockerfile does this again,
#    but you can test locally first)
# -------------------------------------------------
npm run build:client   # runs inside the root (calls the script in package.json)

# -------------------------------------------------
# 3. Build the Docker image
# -------------------------------------------------
docker build -t mcp-client:latest .

# -------------------------------------------------
# 4. Run the container (optional custom registry)
# -------------------------------------------------
docker run -d \
  -p 8080:3000 \                         # host 8080 → container 3000 (Express)
  -v "$(pwd)/mcp.json:/app/mcp.json:ro" \ # mount custom registry (optional)
  --name mcp-client-instance \
  mcp-client:latest
```

Open a browser at **`http://localhost:8080`**.  
You should see the Angular UI, be able to attach a file, pick the (only) LLM from the dropdown, and get back nicely formatted HTML produced by your local LLM.

---

### 🎉 All set!

You now have **every single source file** required for a fully‑functional, portable MCP client that runs entirely inside one Docker container. Feel free to:

* Add more entries to `mcp.json`.  
* Extend the back‑end with extra routes (e.g., `/mcp/registry`).  
* Replace the Angular UI with Material components, add authentication, etc.
