package io.github.walter98.giorno;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

/** Memoria dei luoghi e canale delle notifiche, condivisi fra plugin e receiver. */
public final class Luoghi {
    public static final String PREFS = "giorno_luoghi";
    public static final String CANALE = "giorno_arrivi";

    private Luoghi() {}

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void creaCanale(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CANALE) != null) return;
        NotificationChannel canale = new NotificationChannel(CANALE, "Arrivo in un luogo", NotificationManager.IMPORTANCE_DEFAULT);
        canale.setDescription("Ti ricorda cosa c'è da fare quando arrivi a casa, al lavoro o al supermercato.");
        manager.createNotificationChannel(canale);
    }
}
