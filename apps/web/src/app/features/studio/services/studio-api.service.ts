import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  BrandPresetsResponse,
  TextPresetsResponse,
  CompositionPresetsResponse,
  ExportPresetsResponse,
  CreateCompositionResponse,
  DuplicateCompositionResponse,
  StartRenderResponse,
  RenderStatusResponse,
  SaveCompositionPresetResponse,
  SavedCompositionPresetsResponse,
  ValidateCompositionResponse,
  TextOverlay,
  AudioTrack,
  VideoFitConfig,
  VideoComposition,
} from '@social-downloader/contracts';

@Injectable({ providedIn: 'root' })
export class StudioApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/studio`;

  getBrandPresets(): Observable<BrandPresetsResponse> {
    return this.http.get<BrandPresetsResponse>(`${this.baseUrl}/brand-presets`);
  }

  getTextPresets(): Observable<TextPresetsResponse> {
    return this.http.get<TextPresetsResponse>(`${this.baseUrl}/text-presets`);
  }

  getCompositionPresets(): Observable<CompositionPresetsResponse> {
    return this.http.get<CompositionPresetsResponse>(`${this.baseUrl}/composition-presets`);
  }

  getExportPresets(): Observable<ExportPresetsResponse> {
    return this.http.get<ExportPresetsResponse>(`${this.baseUrl}/export-presets`);
  }

  uploadSource(file: File): Observable<{ asset: { id: string; fileName: string; mimeType: string; size: number; duration?: number; width?: number; height?: number; createdAt: string } }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ asset: { id: string; fileName: string; mimeType: string; size: number; duration?: number; width?: number; height?: number; createdAt: string } }>(
      `${this.baseUrl}/sources/upload`,
      formData,
    );
  }

  createComposition(params: {
    sourceAssetId: string;
    brandPresetId?: string;
    exportPresetId?: string;
    videoFit?: VideoFitConfig;
    textTracks?: TextOverlay[];
    audioTracks?: AudioTrack[];
    keepOriginalAudio?: boolean;
    originalAudioVolume?: number;
    brandCustomPosition?: { x: number; y: number };
  }): Observable<CreateCompositionResponse> {
    return this.http.post<CreateCompositionResponse>(
      `${this.baseUrl}/compositions`,
      params,
    );
  }

  duplicateComposition(compositionId: string): Observable<DuplicateCompositionResponse> {
    return this.http.post<DuplicateCompositionResponse>(
      `${this.baseUrl}/compositions/duplicate`,
      { compositionId },
    );
  }

  saveCompositionPreset(name: string, compositionId: string): Observable<SaveCompositionPresetResponse> {
    return this.http.post<SaveCompositionPresetResponse>(
      `${this.baseUrl}/presets`,
      { name, compositionId },
    );
  }

  getSavedPresets(): Observable<SavedCompositionPresetsResponse> {
    return this.http.get<SavedCompositionPresetsResponse>(`${this.baseUrl}/presets`);
  }

  deleteSavedPreset(presetId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/presets/${presetId}`);
  }

  validateComposition(composition: VideoComposition): Observable<ValidateCompositionResponse> {
    return this.http.post<ValidateCompositionResponse>(
      `${this.baseUrl}/validate`,
      { composition },
    );
  }

  startRender(compositionId: string): Observable<StartRenderResponse> {
    return this.http.post<StartRenderResponse>(
      `${this.baseUrl}/renders`,
      { compositionId },
    );
  }

  getRenderStatus(renderId: string): Observable<RenderStatusResponse> {
    return this.http.get<RenderStatusResponse>(
      `${this.baseUrl}/renders/${renderId}`,
    );
  }

  getDownloadUrl(renderId: string): string {
    return `${this.baseUrl}/renders/${renderId}/download`;
  }

  getProgressUrl(renderId: string): string {
    return `${this.baseUrl}/renders/${renderId}/progress`;
  }

  cancelRender(renderId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/renders/${renderId}/cancel`, {});
  }

  uploadAudio(formData: FormData): Observable<{ asset: { id: string; fileName: string; size: number } }> {
    return this.http.post<{ asset: { id: string; fileName: string; size: number } }>(
      `${this.baseUrl}/sources/upload`,
      formData,
    );
  }
}
