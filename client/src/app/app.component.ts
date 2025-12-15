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
