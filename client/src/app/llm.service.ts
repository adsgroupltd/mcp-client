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
