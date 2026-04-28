package com.voicemap.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class RecordingService extends Service {

    private static final String TAG = "RecordingService";
    private static final String CHANNEL_ID = "voicemap_recording";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START  = "START_RECORDING";
    public static final String ACTION_STOP   = "STOP_RECORDING";
    public static final String ACTION_PAUSE  = "PAUSE_RECORDING";
    public static final String ACTION_RESUME = "RESUME_RECORDING";
    public static final String EXTRA_FILE    = "output_file";
    public static final String EXTRA_MODE    = "audio_mode"; // mic | speaker | both
    public static final String EXTRA_PROJECTION = "media_projection";

    // Режимы
    public static final String MODE_MIC     = "mic";
    public static final String MODE_SPEAKER = "speaker";
    public static final String MODE_BOTH    = "both";

    private MediaRecorder mediaRecorder;
    private AudioRecord   audioRecord;
    private Thread        captureThread;
    private volatile boolean capturing = false;
    private volatile boolean paused    = false;

    private String outputFile;
    private String mode = MODE_MIC;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            outputFile = intent.getStringExtra(EXTRA_FILE);
            mode = intent.getStringExtra(EXTRA_MODE) != null
                ? intent.getStringExtra(EXTRA_MODE) : MODE_MIC;

            startForeground(NOTIFICATION_ID, buildNotification(mode));

            if (MODE_MIC.equals(mode)) {
                startMicRecording();
            } else {
                // speaker / both — берём MediaProjection из статика RecordingPlugin
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        && RecordingPlugin.pendingProjection != null) {
                    startSystemAudioRecording(MODE_BOTH.equals(mode));
                } else {
                    // fallback на mic если нет проекции или Android < 10
                    startMicRecording();
                }
            }

        } else if (ACTION_PAUSE.equals(action)) {
            pauseCapture();
        } else if (ACTION_RESUME.equals(action)) {
            resumeCapture();
        } else if (ACTION_STOP.equals(action)) {
            stopCapture();
            stopForeground(true);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    // ── Режим 1: только микрофон ──────────────────────────────────────────────

    private void startMicRecording() {
        try {
            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setOutputFile(outputFile);
            mediaRecorder.prepare();
            mediaRecorder.start();
            Log.d(TAG, "Mic recording started: " + outputFile);
        } catch (IOException e) {
            Log.e(TAG, "startMicRecording failed", e);
            stopSelf();
        }
    }

    // ── Режим 2/3: системный звук (Android 10+) + опционально микрофон ───────

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private void startSystemAudioRecording(boolean includeMic) {
        try {
            android.media.projection.MediaProjection projection = RecordingPlugin.pendingProjection;
            if (projection == null) {
                Log.w(TAG, "No MediaProjection available, falling back to mic");
                startMicRecording();
                return;
            }

            int sampleRate    = 44100;
            int channelConfig = AudioFormat.CHANNEL_IN_STEREO;
            int encoding      = AudioFormat.ENCODING_PCM_16BIT;
            int bufferSize    = AudioRecord.getMinBufferSize(sampleRate, channelConfig, encoding) * 4;

            android.media.AudioPlaybackCaptureConfiguration config =
                new android.media.AudioPlaybackCaptureConfiguration.Builder(projection)
                    .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                    .addMatchingUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .addMatchingUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING)
                    .addMatchingUsage(AudioAttributes.USAGE_GAME)
                    .build();

            audioRecord = new AudioRecord.Builder()
                .setAudioFormat(new AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelConfig)
                    .setEncoding(encoding)
                    .build())
                .setBufferSizeInBytes(bufferSize)
                .setAudioPlaybackCaptureConfig(config)
                .build();

            audioRecord.startRecording();
            capturing = true;

            // Пишем PCM в WAV файл
            final int finalSampleRate = sampleRate;
            final int finalBufferSize = bufferSize;
            captureThread = new Thread(() -> writePcmToWav(finalSampleRate, finalBufferSize));
            captureThread.start();

            Log.d(TAG, "System audio recording started, includeMic=" + includeMic);
        } catch (Exception e) {
            Log.e(TAG, "startSystemAudioRecording failed", e);
            startMicRecording(); // fallback
        }
    }

    private void writePcmToWav(int sampleRate, int bufferSize) {
        // Заменяем .mp4 расширение на .wav
        String wavFile = outputFile.endsWith(".mp4")
            ? outputFile.substring(0, outputFile.length() - 4) + ".wav"
            : outputFile + ".wav";
        outputFile = wavFile;

        try (FileOutputStream fos = new FileOutputStream(wavFile)) {
            // Placeholder WAV header (44 bytes)
            fos.write(new byte[44]);

            long totalBytes = 0;
            byte[] buffer = new byte[bufferSize];

            while (capturing) {
                int read = audioRecord.read(buffer, 0, buffer.length);
                if (read > 0) {
                    if (!paused) {
                        // Запись идёт — сохраняем реальный звук
                        fos.write(buffer, 0, read);
                        totalBytes += read;
                    }
                    // На паузе — просто читаем и отбрасываем (не пишем тишину в файл)
                }
            }

            fos.flush();

            // Обновляем WAV header
            writeWavHeader(wavFile, totalBytes, sampleRate);
            Log.d(TAG, "WAV written: " + totalBytes + " bytes → " + wavFile);

        } catch (IOException e) {
            Log.e(TAG, "writePcmToWav failed", e);
        }
    }

    private void writeWavHeader(String filePath, long dataSize, int sampleRate) throws IOException {
        int channels = 2, bitsPerSample = 16;
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        int blockAlign = channels * bitsPerSample / 8;
        long fileSize = dataSize + 36;

        try (RandomAccessFile raf = new RandomAccessFile(filePath, "rw")) {
            raf.seek(0);
            raf.write("RIFF".getBytes());
            raf.write(intToBytes((int) fileSize));
            raf.write("WAVE".getBytes());
            raf.write("fmt ".getBytes());
            raf.write(intToBytes(16));              // PCM chunk size
            raf.write(shortToBytes((short) 1));     // PCM format
            raf.write(shortToBytes((short) channels));
            raf.write(intToBytes(sampleRate));
            raf.write(intToBytes(byteRate));
            raf.write(shortToBytes((short) blockAlign));
            raf.write(shortToBytes((short) bitsPerSample));
            raf.write("data".getBytes());
            raf.write(intToBytes((int) dataSize));
        }
    }

    private byte[] intToBytes(int v) {
        return ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(v).array();
    }
    private byte[] shortToBytes(short v) {
        return ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(v).array();
    }

    // ── Пауза / Продолжить ───────────────────────────────────────────────────

    private void pauseCapture() {
        paused = true;
        // MediaRecorder pause доступен с API 24+
        if (mediaRecorder != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try { mediaRecorder.pause(); } catch (Exception e) { Log.w(TAG, "pause mr: " + e.getMessage()); }
        }
        Log.d(TAG, "Recording paused");
    }

    private void resumeCapture() {
        paused = false;
        if (mediaRecorder != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try { mediaRecorder.resume(); } catch (Exception e) { Log.w(TAG, "resume mr: " + e.getMessage()); }
        }
        Log.d(TAG, "Recording resumed");
    }

    // ── Остановка ─────────────────────────────────────────────────────────────

    private void stopCapture() {
        // Остановить MediaRecorder (режим mic)
        if (mediaRecorder != null) {
            try { mediaRecorder.stop(); } catch (Exception e) { Log.w(TAG, "stop: " + e.getMessage()); }
            mediaRecorder.release();
            mediaRecorder = null;
        }
        // Остановить AudioRecord (режим speaker/both)
        capturing = false;
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
            audioRecord = null;
        }
        if (captureThread != null) {
            try { captureThread.join(2000); } catch (InterruptedException ignored) {}
            captureThread = null;
        }
        Log.d(TAG, "Recording stopped: " + outputFile);
    }

    // ── Уведомление ──────────────────────────────────────────────────────────

    private Notification buildNotification(String mode) {
        String title = "VoiceMap — запись идёт";
        String subtitle = MODE_SPEAKER.equals(mode) ? "Системный звук" :
                         MODE_BOTH.equals(mode)    ? "Микрофон + системный звук" : "Микрофон";

        Intent stopIntent = new Intent(this, RecordingService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_media_pause, "Остановить", stopPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "VoiceMap Запись",
                NotificationManager.IMPORTANCE_HIGH);
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        stopCapture();
        super.onDestroy();
    }
}
