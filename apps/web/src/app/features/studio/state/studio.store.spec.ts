import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, ɵChangeDetectionScheduler, ɵEffectScheduler } from '@angular/core';
import { StudioStore } from './studio.store';

// This spec runs under vitest's default 'node' environment (no jsdom), which has no
// `localStorage` global — StudioStore.reset()/clearAutosave() touch it directly.
// A minimal in-memory stub is enough; we're not asserting on persisted content here.
if (typeof globalThis.localStorage === 'undefined') {
  const memory = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    clear: () => memory.clear(),
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() { return memory.size; },
  } as Storage;
}

describe('StudioStore', () => {
  let store: StudioStore;

  beforeEach(() => {
    // StudioStore's constructor registers an autosave effect(), which requires an
    // Angular injection context (plus a change-detection scheduler and an effect
    // scheduler) to construct. This is a plain unit test with no component tree and no
    // assertions on the debounced autosave side effect, so no-op stubs are enough — we
    // only care that signal writes/reads work, not that a view re-renders or the effect
    // actually fires.
    const injector = Injector.create({
      providers: [
        { provide: ɵChangeDetectionScheduler, useValue: { notify: () => {}, runningTick: false } },
        { provide: ɵEffectScheduler, useValue: { add: () => {}, schedule: () => {} } },
      ],
    });
    store = runInInjectionContext(injector, () => new StudioStore());
  });

  it('starts with empty state', () => {
    expect(store.sourceAsset()).toBeNull();
    expect(store.selectedPreset()).toBeNull();
    expect(store.textOverlays()).toEqual([]);
    expect(store.audioTracks()).toEqual([]);
    expect(store.composition()).toBeNull();
    expect(store.renderState()).toBe('idle');
    expect(store.renderResult()).toBeNull();
  });

  it('computes hasSource correctly', () => {
    expect(store.hasSource()).toBe(false);
    store.setSource({ id: '1', fileName: 'test.mp4', mimeType: 'video/mp4', size: 1000 });
    expect(store.hasSource()).toBe(true);
  });

  it('computes canRender correctly', () => {
    expect(store.canRender()).toBe(false);
    store.setSource({ id: '1', fileName: 'test.mp4', mimeType: 'video/mp4', size: 1000 });
    expect(store.canRender()).toBe(true);
    store.setRenderState('rendering');
    expect(store.canRender()).toBe(false);
  });

  it('sets and clears source', () => {
    store.setSource({ id: '1', fileName: 'test.mp4', mimeType: 'video/mp4', size: 1000 });
    expect(store.sourceAsset()!.id).toBe('1');
    store.reset();
    expect(store.sourceAsset()).toBeNull();
  });

  it('manages text overlays', () => {
    const overlay = {
      id: 'o1',
      text: 'Hello',
      type: 'message' as const,
      startTime: 0,
      endTime: 5,
      position: 'center' as const,
      style: { fontFamily: 'Arial', fontSize: 48, color: '#fff', opacity: 1 },
    };
    store.addTextOverlay(overlay);
    expect(store.textOverlays().length).toBe(1);
    store.removeTextOverlay('o1');
    expect(store.textOverlays().length).toBe(0);
  });

  it('updates text overlay', () => {
    const overlay = {
      id: 'o1',
      text: 'Hello',
      type: 'message' as const,
      startTime: 0,
      endTime: 5,
      position: 'center' as const,
      style: { fontFamily: 'Arial', fontSize: 48, color: '#fff', opacity: 1 },
    };
    store.addTextOverlay(overlay);
    store.updateTextOverlay('o1', { text: 'Updated' });
    expect(store.textOverlays()[0].text).toBe('Updated');
  });

  it('manages audio tracks', () => {
    const track = { id: 't1', assetId: 'a1', fileName: 'music.mp3', startTime: 0, volume: 1.0 };
    store.addAudioTrack(track);
    expect(store.audioTracks().length).toBe(1);
    store.removeAudioTrack('t1');
    expect(store.audioTracks().length).toBe(0);
  });

  it('resets all state', () => {
    store.setSource({ id: '1', fileName: 'test.mp4', mimeType: 'video/mp4', size: 1000 });
    store.setPreset({ id: 'p1', name: 'Test', signature: { text: '@Test', defaultPosition: 'bottom-center', defaultMode: 'ending' } });
    store.reset();
    expect(store.sourceAsset()).toBeNull();
    expect(store.selectedPreset()).toBeNull();
    expect(store.renderState()).toBe('idle');
  });
});
