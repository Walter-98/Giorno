package io.github.walter98.giorno;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.util.List;

/** Riceve l'avviso del sistema quando entri in un luogo salvato e mostra la notifica. */
public class GeofenceReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent evento = GeofencingEvent.fromIntent(intent);
        if (evento == null || evento.hasError()) return;
        List<Geofence> entrati = evento.getTriggeringGeofences();
        if (entrati == null || entrati.isEmpty()) return;

        Luoghi.creaCanale(context);
        SharedPreferences prefs = Luoghi.prefs(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        for (Geofence luogo : entrati) {
            String id = luogo.getRequestId();
            String nome = prefs.getString(id + ":nome", "");
            String testo = prefs.getString(id + ":testo", "");
            if (nome.isEmpty()) continue;

            Intent apri = new Intent(context, MainActivity.class);
            apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent tocco = PendingIntent.getActivity(context, id.hashCode(), apri, flags);

            Notification notifica = new NotificationCompat.Builder(context, Luoghi.CANALE)
                .setSmallIcon(R.drawable.ic_stat_giorno)
                .setContentTitle("Sei a " + nome)
                .setContentText(testo.isEmpty() ? "Guarda cosa c'è da fare qui." : testo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(testo.isEmpty() ? "Guarda cosa c'è da fare qui." : testo))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(tocco)
                .build();

            manager.notify(id.hashCode(), notifica);
        }
    }
}
