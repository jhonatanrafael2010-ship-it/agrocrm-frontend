package com.agrocrm.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // 🧭 Ajusta o WebView para responsividade
    WebSettings webSettings = getBridge().getWebView().getSettings();
    webSettings.setLoadWithOverviewMode(true);
    webSettings.setUseWideViewPort(true);
    webSettings.setDomStorageEnabled(true);
    webSettings.setDatabaseEnabled(true);
    webSettings.setAllowFileAccess(true);
    webSettings.setJavaScriptEnabled(true);
  }
}
