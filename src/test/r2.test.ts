import { describe, it, expect } from 'vitest';
import { isValidRecordingId, isOwnedKey, resolveExt } from '../../server/lib/r2';

const UID = 'TNfU8vMl2aX1ymdxCNZTaiWzXiv2';
const OTHER_UID = 'aaaaBBBBccccDDDDeeeeFFFFgggg';

// ─── isOwnedKey: граница между «своим» и «чужим» файлом ──────────────────────
// Эта проверка стоит на пути удаления объекта из R2. Дыра здесь означает, что
// пользователь удалит чужую запись, передав подобранный ключ.

describe('isOwnedKey — доступ только к своим файлам', () => {
  it('пропускает собственный ключ правильной формы', () => {
    expect(isOwnedKey(`audio/${UID}/1784816224908.webm`, UID)).toBe(true);
    expect(isOwnedKey(`audio/${UID}/rec-123_a.mp3`, UID)).toBe(true);
  });

  it('НЕ пропускает файл другого пользователя', () => {
    expect(isOwnedKey(`audio/${OTHER_UID}/1784816224908.webm`, UID)).toBe(false);
  });

  it('блокирует обход каталога через ..', () => {
    expect(isOwnedKey(`audio/${UID}/../${OTHER_UID}/secret.webm`, UID)).toBe(false);
    expect(isOwnedKey(`audio/${UID}/..%2Fsecret.webm`, UID)).toBe(false);
    expect(isOwnedKey('../../etc/passwd', UID)).toBe(false);
  });

  it('блокирует двойной слэш — им можно подменить путь', () => {
    expect(isOwnedKey(`audio/${UID}//other.webm`, UID)).toBe(false);
    expect(isOwnedKey(`audio//${UID}/file.webm`, UID)).toBe(false);
  });

  it('не даёт вылезти из папки audio', () => {
    expect(isOwnedKey(`config/${UID}/file.webm`, UID)).toBe(false);
    expect(isOwnedKey(`${UID}/file.webm`, UID)).toBe(false);
  });

  it('не пропускает чужой uid как префикс своего', () => {
    // uid жертвы начинается с uid атакующего — проверка не должна ловиться на startsWith
    expect(isOwnedKey(`audio/${UID}extra/file.webm`, UID)).toBe(false);
  });

  it('требует расширение из белого списка — исполняемое не пройдёт', () => {
    expect(isOwnedKey(`audio/${UID}/payload.js`, UID)).toBe(false);
    expect(isOwnedKey(`audio/${UID}/payload.sh`, UID)).toBe(false);
    expect(isOwnedKey(`audio/${UID}/noext`, UID)).toBe(false);
  });

  it('не принимает вложенные пути внутри своей папки', () => {
    expect(isOwnedKey(`audio/${UID}/sub/file.webm`, UID)).toBe(false);
  });

  it('отвергает не-строки', () => {
    expect(isOwnedKey(undefined, UID)).toBe(false);
    expect(isOwnedKey(null, UID)).toBe(false);
    expect(isOwnedKey(42, UID)).toBe(false);
    expect(isOwnedKey({ key: `audio/${UID}/f.webm` }, UID)).toBe(false);
  });
});

// ─── isValidRecordingId: из него строится путь в R2 ─────────────────────────

describe('isValidRecordingId', () => {
  it('пропускает обычные идентификаторы', () => {
    expect(isValidRecordingId('1784816224908')).toBe(true);
    expect(isValidRecordingId('rec_123-abc')).toBe(true);
  });

  it('блокирует слэши и точки — из id строится путь к файлу', () => {
    expect(isValidRecordingId('../../secret')).toBe(false);
    expect(isValidRecordingId('a/b')).toBe(false);
    expect(isValidRecordingId('file.webm')).toBe(false);
  });

  it('блокирует пустое и слишком длинное', () => {
    expect(isValidRecordingId('')).toBe(false);
    expect(isValidRecordingId('a'.repeat(65))).toBe(false);
    expect(isValidRecordingId('a'.repeat(64))).toBe(true);
  });

  it('отвергает не-строки', () => {
    expect(isValidRecordingId(undefined)).toBe(false);
    expect(isValidRecordingId(1784816224908)).toBe(false);
  });
});

// ─── resolveExt: whitelist форматов ─────────────────────────────────────────

describe('resolveExt', () => {
  it('понимает браузерную запись', () => {
    expect(resolveExt('audio/webm')).toBe('webm');
    expect(resolveExt('audio/webm;codecs=opus')).toBe('webm');
    expect(resolveExt('audio/mp4')).toBe('mp4');
  });

  it('понимает форматы внешних устройств — диктофоны, очки', () => {
    expect(resolveExt('audio/mpeg')).toBe('mp3');
    expect(resolveExt('audio/x-m4a')).toBe('m4a');
    expect(resolveExt('audio/flac')).toBe('flac');
    expect(resolveExt('audio/wav')).toBe('wav');
  });

  it('отсекает параметры и регистр', () => {
    expect(resolveExt('AUDIO/WEBM')).toBe('webm');
    expect(resolveExt('audio/mp4; codecs="mp4a.40.2"')).toBe('mp4');
  });

  it('не пропускает не-аудио — это защита, а не удобство', () => {
    expect(resolveExt('application/javascript')).toBeNull();
    expect(resolveExt('text/html')).toBeNull();
    expect(resolveExt('image/png')).toBeNull();
    expect(resolveExt('')).toBeNull();
  });
});
