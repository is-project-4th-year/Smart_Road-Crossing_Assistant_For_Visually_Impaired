package smartroad.assistant;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // CRITICAL: Register plugin BEFORE super.onCreate() for Capacitor 7
        registerPlugin(DetectorPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}

