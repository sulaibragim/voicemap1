package com.voicemap.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;

@CapacitorPlugin(
    name = "NativeRecorder",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
    }
)
public class RecordingPlugin extends Plugin {

    // Статик для передачи MediaProjection в сервис (Intent не поддерживает Parcelable MediaProjection)
    public static MediaProjection pendingProjection = null;

    private String pendingMode;
    private String pendingFilePath;

    @PluginMethod
    public void startRecording(PluginCall call) {
        String mode = call.getString("mode", RecordingService.MODE_MIC);

        if ((RecordingService.MODE_SPEAKER.equals(mode) || RecordingService.MODE_BOTH.equals(mode))
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                call.setKeepAlive(true);
                requestPermissionForAlias("microphone", call, "micThenProjection");
                return;
            }
            requestProjection(call, mode);
            return;
        }

        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.setKeepAlive(true);
            requestPermissionForAlias("microphone", call, "micResult");
            return;
        }
        doStart(call, RecordingService.MODE_MIC, false);
    }

    @PermissionCallback
    private void micResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            doStart(call, RecordingService.MODE_MIC, false);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    @PermissionCallback
    private void micThenProjection(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission denied");
            return;
        }
        String mode = call.getString("mode", RecordingService.MODE_BOTH);
        requestProjection(call, mode);
    }

    private void requestProjection(PluginCall call, String mode) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            doStart(call, RecordingService.MODE_MIC, false);
            return;
        }
        pendingMode = mode;
        pendingFilePath = makeFilePath(".mp4");
        call.setKeepAlive(true);

        MediaProjectionManager mgr = (MediaProjectionManager)
            getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, mgr.createScreenCaptureIntent(), "projectionResult");
    }

    @ActivityCallback
    private void projectionResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            // Пользователь отказал — пишем только микрофон
            pendingProjection = null;
            doStartWithPath(call, RecordingService.MODE_MIC, pendingFilePath);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaProjectionManager mgr = (MediaProjectionManager)
                getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            pendingProjection = mgr.getMediaProjection(result.getResultCode(), result.getData());
        }
        doStartWithPath(call, pendingMode, pendingFilePath);
    }

    private void doStart(PluginCall call, String mode, boolean hasProjection) {
        doStartWithPath(call, mode, makeFilePath(".mp4"));
    }

    private void doStartWithPath(PluginCall call, String mode, String filePath) {
        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_START);
        intent.putExtra(RecordingService.EXTRA_FILE, filePath);
        intent.putExtra(RecordingService.EXTRA_MODE, mode);
        // projection передаётся через статик pendingProjection

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        JSObject result = new JSObject();
        result.put("filePath", filePath);
        result.put("fileName", new File(filePath).getName());
        result.put("mode", mode);
        call.resolve(result);
    }

    @PluginMethod
    public void pauseRecording(PluginCall call) {
        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_PAUSE);
        getContext().startService(intent);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void resumeRecording(PluginCall call) {
        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_RESUME);
        getContext().startService(intent);
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_STOP);
        getContext().startService(intent);

        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            pendingProjection = null;
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        }, 1000);
    }

    private String makeFilePath(String ext) {
        String fileName = "voicemap_" + System.currentTimeMillis() + ext;
        return new File(getContext().getCacheDir(), fileName).getAbsolutePath();
    }
}
