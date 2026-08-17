import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  BrandPresetsResponse,
  CreateCompositionResponse,
  StartRenderResponse,
  RenderStatusResponse,
  TextOverlay,
  AudioTrack,
} from '@social-downloader/contracts';

@Injectable({ providedIn: 'root' })
export class StudioApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/studio`;

  getBrandPresets(): Observable<BrandPresetsResponse> {
    return this.http.get<BrandPresetsResponse>(`${this.baseUrl}/brand-presets`);
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
    textTracks?: TextOverlay[];
    audioTracks?: AudioTrack[];
    keepOriginalAudio?: boolean;
    originalAudioVolume?: number;
  }): Observable<CreateCompositionResponse> {
    return this.http.post<CreateCompositionResponse>(
      `${this.baseUrl}/compositions`,
      params,
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
}
