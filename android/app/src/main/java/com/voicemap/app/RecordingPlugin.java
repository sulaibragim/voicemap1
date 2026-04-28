package com.voicemap.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "NativeRecorder")
public class RecordingPlugin extends Plugin {

    @PluginMethod
    public void startRecording(PluginCall call) {
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

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}
