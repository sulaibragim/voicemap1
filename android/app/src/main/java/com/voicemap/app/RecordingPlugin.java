package com.voicemap.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
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

    private PluginCall savedCall;
    private String pendingFilePath;

    @PluginMethod
    public void startRecording(PluginCall call) {
        // Проверяем permission на микрофон
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            savedCall = call;
            requestPermissionForAlias("microphone", call, "microphoneResult");
            return;
        }
        doStartRecording(call);
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            doStartRecording(call);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    private void doStartRecording(PluginCall call) {
        String fileName = "voicemap_" + System.currentTimeMillis() + ".mp4";
        File outputFile = new File(getContext().getCacheDir(), fileName);

        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_START);
        intent.putExtra(RecordingService.EXTRA_FILE, outputFile.getAbsolutePath());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        JSObject result = new JSObject();
        result.put("filePath", outputFile.getAbsolutePath());
        result.put("fileName", fileName);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        Intent intent = new Intent(getContext(), RecordingService.class);
        intent.setAction(RecordingService.ACTION_STOP);
        getContext().startService(intent);

        // Даём сервису 800ms закончить запись в файл
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        }, 800);
    }
}
