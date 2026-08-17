/**
 * Studio Smoke Test — FFmpeg real render verification
 *
 * Tests:
 * - Creates a 15s test video (color source + sine audio)
 * - Builds a composition with text overlay + brand signature
 * - Renders via FFmpeg
 * - Verifies output with FFprobe: H.264, AAC, 1080x1920, MP4
 */

import { FfmpegService } from './infrastructure/ffmpeg/ffmpeg.service';
import { FfmpegVideoRenderer } from './infrastructure/ffmpeg/ffmpeg-video-renderer';
import { TempAssetStorage } from './infrastructure/storage/temp-asset-storage.service';
import { buildProbeCommand } from './infrastructure/ffmpeg/ffmpeg-command-builder';
import type { VideoComposition } from './domain/video-composition';
import { DEFAULT_OUTPUT } from './domain/video-composition';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const SOURCE_PATH = '/tmp/test-source.mp4';

async function main(): Promise<void> {
  console.log('🎬 Studio Smoke Test — Starting...\n');

  const ffmpeg = new FfmpegService();
  const storage = new TempAssetStorage();

  // 1. Verify FFmpeg/FFprobe available
  console.log('1. Checking FFmpeg/FFprobe...');
  const ffmpegPath = await ffmpeg.resolveFfmpeg();
  const ffprobePath = await ffmpeg.resolveFfprobe();
  console.log(`   FFmpeg:  ${ffmpegPath}`);
  console.log(`   FFprobe: ${ffprobePath}`);
  console.log('   ✓ Both available\n');

  // 2. Create asset from test source
  console.log('2. Creating asset from test source...');
  const sourceBuffer = await readFile(SOURCE_PATH);
  const { id: assetId } = await storage.createAsset('test-source.mp4', sourceBuffer);
  console.log(`   Asset ID: ${assetId}`);

  // 3. Probe source
  console.log('3. Probing source video...');
  const renderer = new FfmpegVideoRenderer(ffmpeg, storage);
  const probe = await renderer.probe(SOURCE_PATH);
  console.log(`   Duration: ${probe.duration}s`);
  console.log(`   Resolution: ${probe.width}x${probe.height}`);
  console.log('   ✓ Source OK\n');

  // 4. Build composition
  console.log('4. Building composition...');
  const composition: VideoComposition = {
    id: randomUUID(),
    source: {
      assetId,
      fileName: 'test-source.mp4',
      duration: probe.duration ?? 15,
      width: probe.width ?? 1080,
      height: probe.height ?? 1920,
    },
    output: { ...DEFAULT_OUTPUT, fps: 24 },
    overlays: [
      {
        id: 'brand-ending',
        presetId: 'ilusiones-colores',
        text: '@Ilusiones&Colores',
        startTime: 12.5,
        endTime: 15,
        position: 'bottom-center',
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 32,
          fontWeight: 'normal',
          italic: true,
          color: '#f6efe2',
          opacity: 0.85,
          textShadow: true,
          shadowColor: 'black@0.75',
        },
        animationIn: 'fade-in',
        animationOut: 'none',
        opacity: 0.85,
      },
    ],
    textTracks: [
      {
        id: 'text-main',
        text: 'SU FE NO EMPEZÓ\nCON CERTEZA',
        type: 'message',
        startTime: 0.5,
        endTime: 5,
        position: 'center',
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 56,
          fontWeight: 'bold',
          color: '#f6efe2',
          opacity: 1,
          textShadow: true,
          shadowColor: 'black@0.8',
        },
      },
      {
        id: 'text-verse',
        text: 'A donde tú vayas, iré;\ntu pueblo será mi pueblo.',
        type: 'verse',
        startTime: 5.5,
        endTime: 10,
        position: 'center',
        style: {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 48,
          fontWeight: 'normal',
          italic: true,
          color: '#f6efe2',
          opacity: 1,
          textShadow: true,
          shadowColor: 'black@0.8',
        },
      },
    ],
    audioTracks: [],
    keepOriginalAudio: true,
    originalAudioVolume: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  console.log(`   Composition ID: ${composition.id}`);
  console.log(`   Text tracks: ${composition.textTracks.length}`);
  console.log(`   Brand overlays: ${composition.overlays.length}`);
  console.log('   ✓ Composition built\n');

  // 5. Render
  console.log('5. Rendering with FFmpeg...');
  const start = Date.now();

  const renderResult = await renderer.render(composition);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`   Render ID: ${renderResult.render.id}`);
  console.log(`   Output: ${renderResult.filePath}`);
  console.log(`   File size: ${(renderResult.render.fileSize ?? 0 / 1024).toFixed(0)} KB`);
  console.log(`   Render time: ${elapsed}s`);
  console.log('   ✓ Render complete\n');

  // 6. Verify output with FFprobe
  console.log('6. Verifying output with FFprobe...');
  const { args } = buildProbeCommand(renderResult.filePath);
  const probeResult = await ffmpeg.runFfprobe({ args, timeoutMs: 15_000 });
  const info = JSON.parse(probeResult.stdout);

  const videoStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  const audioStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
  const format = info.format;

  const duration = Number(format.duration);
  const width = Number(videoStream.width);
  const height = Number(videoStream.height);
  const videoCodec = videoStream.codec_name;
  const audioCodec = audioStream?.codec_name;
  const container = format.format_name;

  console.log(`   Container: ${container}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Resolution: ${width}x${height}`);
  console.log(`   Video codec: ${videoCodec}`);
  console.log(`   Audio codec: ${audioCodec}`);
  console.log(`   Aspect ratio: ${width}:${height} = ${(width / height).toFixed(4)}`);

  // 7. Validate expectations
  console.log('\n7. Validating expectations...');
  const checks: Array<{ name: string; pass: boolean; expected: string; actual: string }> = [];

  checks.push({
    name: 'Container is MP4',
    pass: container.includes('mp4'),
    expected: 'mp4',
    actual: container,
  });
  checks.push({
    name: 'Video codec is H.264',
    pass: videoCodec === 'h264',
    expected: 'h264',
    actual: videoCodec,
  });
  checks.push({
    name: 'Audio codec is AAC',
    pass: audioCodec === 'aac',
    expected: 'aac',
    actual: audioCodec ?? 'none',
  });
  checks.push({
    name: 'Resolution is 1080x1920',
    pass: width === 1080 && height === 1920,
    expected: '1080x1920',
    actual: `${width}x${height}`,
  });
  checks.push({
    name: 'Aspect ratio is 9:16',
    pass: Math.abs(width / height - 9 / 16) < 0.01,
    expected: '0.5625',
    actual: (width / height).toFixed(4),
  });
  checks.push({
    name: 'Duration ~15s (within 1s tolerance)',
    pass: Math.abs(duration - 15) < 1,
    expected: '~15',
    actual: String(duration),
  });
  checks.push({
    name: 'File size > 1KB',
    pass: (renderResult.render.fileSize ?? 0) > 1024,
    expected: '>1024',
    actual: String(renderResult.render.fileSize),
  });

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}: ${check.actual}`);
    if (!check.pass) {
      allPassed = false;
      console.log(`      Expected: ${check.expected}`);
    }
  }

  // Cleanup
  await storage.deleteAsset(assetId);

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ SMOKE TEST PASSED — Studio pipeline is functional');
  } else {
    console.log('❌ SMOKE TEST FAILED — See above for details');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Smoke test error:', err);
  process.exit(1);
});
