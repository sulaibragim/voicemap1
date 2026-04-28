package com.voicemap.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;

public class RecordingService extends Service {

    private static final String TAG = "RecordingService";
    private static final String CHANNEL_ID = "voicemap_recording";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "START_RECORDING";
    public static final String ACTION_STOP  = "STOP_RECORDING";
    public static final String EXTRA_FILE   = "output_file";

    private MediaRecorder recorder;
    private String outputFile;

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
            startForeground(NOTIFICATION_ID, buildNotification());
            startRecording();
        } else if (ACTION_STOP.equals(action)) {
            stopRecording();
            stopForeground(true);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void startRecording() {
        try {
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setOutputFile(outputFile);
            recorder.prepare();
            recorder.start();
            Log.d(TAG, "Recording started: " + outputFile);
        } catch (IOException e) {
            Log.e(TAG, "Recording failed", e);
            stopSelf();
        }
    }

    private void stopRecording() {
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (Exception e) {
                Log.w(TAG, "Stop recording error (may be empty): " + e.getMessage());
            }
            recorder.release();
            recorder = null;
            Log.d(TAG, "Recording stopped: " + outputFile);
        }
    }

    private Notification buildNotification() {
        Intent stopIntent = new Intent(this, RecordingService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VoiceMap — запись идёт")
            .setContentText("Нажмите чтобы открыть приложение")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_media_pause, "Остановить", stopPending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "VoiceMap Запись",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Показывается пока идёт запись");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopRecording();
        super.onDestroy();
    }
}
