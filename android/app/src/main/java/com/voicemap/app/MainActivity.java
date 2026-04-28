package com.voicemap.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecordingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
