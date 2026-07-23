import { describe, it, expect } from 'vitest';
import {
  getFileExtension,
  guessAudioMimeFromUrl,
  isSupportedAudioMime,
  resolveAudioMime,
} from '../lib/audioMime';

describe('getFileExtension', () => {
  it('возвращает расширение в нижнем регистре', () => {
    expect(getFileExtension('Запись.M4A')).toBe('m4a');
    expect(getFileExtension('meeting.2026.01.wav')).toBe('wav');
  });

  it('возвращает пустую строку, если расширения нет', () => {
    expect(getFileExtension('recording')).toBe('');
    expect(getFileExtension('recording.')).toBe('');
  });
});

describe('resolveAudioMime', () => {
  it('нормализует алиасы браузеров к каноническому типу', () => {
    expect(resolveAudioMime('audio/mpeg', 'note.mp3')).toBe('audio/mp3');
    expect(resolveAudioMime('audio/x-m4a', 'glasses.m4a')).toBe('audio/mp4');
    expect(resolveAudioMime('audio/x-wav', 'dictaphone.wav')).toBe('audio/wav');
    expect(resolveAudioMime('audio/x-flac', 'hifi.flac')).toBe('audio/flac');
    expect(resolveAudioMime('audio/opus', 'voice.opus')).toBe('audio/ogg');
  });

  it('отбрасывает codecs-параметр', () => {
    expect(resolveAudioMime('audio/webm;codecs=opus', 'rec.webm')).toBe('audio/webm');
  });

  it('определяет тип по расширению, когда браузер его не отдал', () => {
    expect(resolveAudioMime('', 'meta-glasses-recording.m4a')).toBe('audio/mp4');
    expect(resolveAudioMime('', 'voice.MP3')).toBe('audio/mp3');
  });

  it('отклоняет не-аудио файлы', () => {
    expect(resolveAudioMime('video/mp4', 'clip.mp4')).toBeNull();
    expect(resolveAudioMime('application/pdf', 'doc.pdf')).toBeNull();
    expect(resolveAudioMime('', 'photo.jpg')).toBeNull();
  });
});

describe('isSupportedAudioMime', () => {
  it('принимает форматы из whitelist сервера', () => {
    for (const mime of ['audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac']) {
      expect(isSupportedAudioMime(mime)).toBe(true);
    }
  });

  it('отклоняет неизвестные форматы', () => {
    expect(isSupportedAudioMime('audio/aiff')).toBe(false);
    expect(isSupportedAudioMime('audio/amr')).toBe(false);
  });
});

describe('guessAudioMimeFromUrl', () => {
  it('определяет тип по расширению ключа R2', () => {
    expect(guessAudioMimeFromUrl('https://pub.r2.dev/audio/uid/123.webm')).toBe('audio/webm');
    expect(guessAudioMimeFromUrl('https://pub.r2.dev/audio/uid/123.mp3')).toBe('audio/mp3');
    expect(guessAudioMimeFromUrl('https://pub.r2.dev/audio/uid/123.ogg')).toBe('audio/ogg');
  });

  it('игнорирует query-строку', () => {
    expect(guessAudioMimeFromUrl('https://pub.r2.dev/audio/uid/1.wav?token=abc')).toBe('audio/wav');
  });

  it('по умолчанию audio/mp4', () => {
    expect(guessAudioMimeFromUrl('https://pub.r2.dev/audio/uid/legacy')).toBe('audio/mp4');
  });
});
