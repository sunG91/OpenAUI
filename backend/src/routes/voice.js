/**
 * 语音相关 API：录音上传、本地保存、STT、TTS
 *
 * 说明：本项目目标“免费”，这里仅提供离线链路的后端能力接口。
 * - STT: whisper.cpp / vosk（需要你放置对应引擎与模型）
 * - TTS: Windows SAPI（免费，Windows 环境可用）
 */
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { readVoiceSettings } = require('../voice-settings-store');
const { execBundled } = require('../ffmpeg/ffmpeg');
const { transcribeWithWhisperCpp } = require('../voice/stt/whispercpp');
const { transcribeWithVosk } = require('../voice/stt/vosk');
const { synthesizeWithSapi, listSapiVoices } = require('../voice/tts/sapi');
const { synthesizeWithPiper, listPiperVoices } = require('../voice/tts/piper');
const { synthesizeWithGptSoVits, listGptSoVitsVoices } = require('../voice/tts/gptsovits');
const { synthesizeWithEdgeTts, listEdgeZhVoices } = require('../voice/tts/edge');

const DATA_DIR = path.join(__dirname, '../../data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const RECORDINGS_DIR = path.join(MEDIA_DIR, 'recordings');
const TTS_DIR = path.join(MEDIA_DIR, 'tts');
const TMP_DIR = path.join(DATA_DIR, 'tmp');

function ensureDirs() {
  [DATA_DIR, MEDIA_DIR, RECORDINGS_DIR, TTS_DIR, TMP_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  }
});

async function toWav16kMono(inputPath, outputPath) {
  // ffmpeg.exe -i input -ac 1 -ar 16000 -c:a pcm_s16le out.wav
  await execBundled('ffmpeg.exe', [
    '-y',
    '-i', inputPath,
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outputPath
  ]);
}

function mountVoiceRoutes(app) {
  ensureDirs();

  // 让前端可以通过 URL 直接访问本地生成的音频文件
  app.use('/media', require('express').static(MEDIA_DIR, { fallthrough: false }));

  /**
   * 上传录音并做 STT
   * multipart/form-data:
   * - audio: Blob/File
   * - mime: 可选（前端传，方便记录）
   */
  app.post('/api/voice/stt', upload.single('audio'), async (req, res) => {
    try {
      const settings = readVoiceSettings();
      if (!settings.enabled || !settings.sttEnabled) {
        return res.status(400).json({ success: false, error: '语音或 STT 未启用' });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, error: '缺少 audio 文件' });
      }

      const id = nowId();
      const ext = (req.file.mimetype && req.file.mimetype.includes('ogg')) ? 'ogg'
        : (req.file.mimetype && req.file.mimetype.includes('webm')) ? 'webm'
        : 'bin';
      const rawName = `${id}.${ext}`;
      const rawPath = path.join(RECORDINGS_DIR, rawName);
      fs.writeFileSync(rawPath, req.file.buffer);

      const wavName = `${id}.wav`;
      const wavPath = path.join(TMP_DIR, wavName);
      await toWav16kMono(rawPath, wavPath);

      let text = '';
      if (settings.sttEngine === 'vosk') {
        text = await transcribeWithVosk(wavPath, settings);
      } else {
        text = await transcribeWithWhisperCpp(wavPath, settings);
      }

      const audioUrl = settings.saveAudioToLocal !== false ? `/media/recordings/${rawName}` : '';
      return res.json({
        success: true,
        text: (text || '').trim(),
        audioUrl,
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  /**
   * TTS：把文本合成为 wav，返回可访问 URL
   * body: { text, voice?, rate? }
   */
  app.post('/api/voice/tts', async (req, res) => {
    try {
      const settings = readVoiceSettings();
      if (!settings.enabled || !settings.ttsEnabled) {
        return res.status(400).json({ success: false, error: '语音或 TTS 未启用' });
      }

      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!text) return res.status(400).json({ success: false, error: '缺少 text' });

      const id = nowId();
      const outName = `${id}.wav`;
      const outPath = path.join(TTS_DIR, outName);

      const voice = typeof req.body?.voice === 'string' ? req.body.voice : (settings.ttsVoice || '');
      const rate = typeof req.body?.rate === 'number' ? req.body.rate : (typeof settings.ttsRate === 'number' ? settings.ttsRate : 0);

      if (settings.ttsEngine === 'gptsovits') {
        return res.status(400).json({
          success: false,
          error: 'GPT-SoVITS 尚未接入：当前仅保留引擎入口（占位）',
        });
      } else if (settings.ttsEngine === 'edge') {
        try {
          const { tmpWebm } = await synthesizeWithEdgeTts({ text, outPath, voice, rate });
          await execBundled('ffmpeg.exe', [
            '-y',
            '-i', tmpWebm,
            '-ac', '1',
            '-ar', '16000',
            '-c:a', 'pcm_s16le',
            outPath
          ]);
          try { fs.unlinkSync(tmpWebm); } catch {}
        } catch (e) {
          return res.status(500).json({
            success: false,
            error: `Edge TTS 合成失败（需要联网）。请检查网络/代理/防火墙后重试：${e?.message || String(e)}`,
          });
        }
      } else if (settings.ttsEngine === 'piper') {
        await synthesizeWithPiper({ text, outPath, voiceId: voice, rate });
      } else {
        await synthesizeWithSapi({ text, outPath, voice, rate });
      }

      return res.json({
        success: true,
        audioUrl: `/media/tts/${outName}`,
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.get('/api/voice/tts/voices', async (req, res) => {
    try {
      const sapi = await listSapiVoices();
      const piper = listPiperVoices();
      const gptsovits = listGptSoVitsVoices();
      const edge = listEdgeZhVoices();
      return res.json({
        success: true,
        sapi: sapi.map((name) => ({ id: name, label: name })),
        piper,
        gptsovits,
        edge,
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });
}

module.exports = { mountVoiceRoutes };

