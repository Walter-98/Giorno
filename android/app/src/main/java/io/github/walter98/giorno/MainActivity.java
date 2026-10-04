package io.github.walter98.giorno;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Colore della barra di stato, lo stesso verde scuro dell'intestazione. */
    private static final int COLORE_BARRE = Color.parseColor("#153C39");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GeofencePlugin.class);
        super.onCreate(savedInstanceState);
        sistemaBarre();
    }

    /**
     * Da Android 15 l'app disegna sotto le barre di sistema: lasciamo lo spazio
     * a orologio e barra di navigazione e coloriamo di verde quello che resta scoperto.
     */
    private void sistemaBarre() {
        getWindow().getDecorView().setBackgroundColor(COLORE_BARRE);
        WindowInsetsControllerCompat icone = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        icone.setAppearanceLightStatusBars(false);
        icone.setAppearanceLightNavigationBars(false);

        View contenuto = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(contenuto, (vista, insets) -> {
            Insets barre = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime()
            );
            vista.setPadding(barre.left, barre.top, barre.right, barre.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
