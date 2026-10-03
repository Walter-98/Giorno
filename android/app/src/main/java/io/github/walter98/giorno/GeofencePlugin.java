package io.github.walter98.giorno;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * Registra nel sistema i luoghi di Giorno: è Android, non l'app, a sorvegliare
 * la posizione e a svegliarci quando si entra in uno di essi.
 */
@CapacitorPlugin(
    name = "Geofence",
    permissions = {
        @Permission(alias = "posizione", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "sempre", strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = "notifiche", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class GeofencePlugin extends Plugin {

    private GeofencingClient client;

    @Override
    public void load() {
        client = LocationServices.getGeofencingClient(getContext());
        Luoghi.creaCanale(getContext());
    }

    private boolean concesso(String permesso) {
        return ContextCompat.checkSelfPermission(getContext(), permesso) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject statoPermessi() {
        JSObject stato = new JSObject();
        stato.put("posizione", concesso(Manifest.permission.ACCESS_FINE_LOCATION));
        stato.put(
            "sempre",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || concesso(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        );
        stato.put(
            "notifiche",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || concesso(Manifest.permission.POST_NOTIFICATIONS)
        );
        stato.put("nativo", true);
        return stato;
    }

    @PluginMethod
    public void permessi(PluginCall call) {
        call.resolve(statoPermessi());
    }

    @PluginMethod
    public void chiediPosizione(PluginCall call) {
        if (concesso(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.resolve(statoPermessi());
            return;
        }
        requestPermissionForAlias("posizione", call, "finePermesso");
    }

    @PermissionCallback
    private void finePermesso(PluginCall call) {
        call.resolve(statoPermessi());
    }

    @PluginMethod
    public void chiediSempre(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || concesso(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
            call.resolve(statoPermessi());
            return;
        }
        requestPermissionForAlias("sempre", call, "semprePermesso");
    }

    @PermissionCallback
    private void semprePermesso(PluginCall call) {
        call.resolve(statoPermessi());
    }

    @PluginMethod
    public void chiediNotifiche(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || concesso(Manifest.permission.POST_NOTIFICATIONS)) {
            call.resolve(statoPermessi());
            return;
        }
        requestPermissionForAlias("notifiche", call, "notifichePermesso");
    }

    @PermissionCallback
    private void notifichePermesso(PluginCall call) {
        call.resolve(statoPermessi());
    }

    /** Apre la pagina di sistema dell'app: da Android 11 il permesso "Consenti sempre" si dà solo da lì. */
    @PluginMethod
    public void apriImpostazioni(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    private PendingIntent intento() {
        Intent intent = new Intent(getContext(), GeofenceReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT |
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(getContext(), 0, intent, flags);
    }

    /** Sostituisce l'elenco dei luoghi sorvegliati con quello passato da Giorno. */
    @PluginMethod
    public void imposta(PluginCall call) {
        if (!concesso(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.reject("posizione-mancante");
            return;
        }
        JSArray elenco = call.getArray("luoghi");
        if (elenco == null) {
            call.reject("luoghi-mancanti");
            return;
        }

        List<Geofence> recinti = new ArrayList<>();
        SharedPreferences.Editor memoria = Luoghi.prefs(getContext()).edit();
        memoria.clear();
        try {
            for (int i = 0; i < elenco.length(); i++) {
                JSONObject luogo = elenco.getJSONObject(i);
                String id = luogo.getString("id");
                double lat = luogo.getDouble("lat");
                double lon = luogo.getDouble("lon");
                float raggio = (float) luogo.optDouble("radius", 150);
                memoria.putString(id + ":nome", luogo.optString("name", "un luogo"));
                memoria.putString(id + ":testo", luogo.optString("testo", ""));
                recinti.add(
                    new Geofence.Builder()
                        .setRequestId(id)
                        .setCircularRegion(lat, lon, Math.max(50f, raggio))
                        .setExpirationDuration(Geofence.NEVER_EXPIRE)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
                        .build()
                );
            }
        } catch (Exception errore) {
            call.reject("luoghi-non-validi: " + errore.getMessage());
            return;
        }
        memoria.apply();

        PendingIntent intento = intento();
        client
            .removeGeofences(intento)
            .addOnCompleteListener(primo -> {
                if (recinti.isEmpty()) {
                    JSObject vuoto = new JSObject();
                    vuoto.put("attivi", 0);
                    call.resolve(vuoto);
                    return;
                }
                GeofencingRequest richiesta = new GeofencingRequest.Builder()
                    .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                    .addGeofences(recinti)
                    .build();
                try {
                    client
                        .addGeofences(richiesta, intento)
                        .addOnSuccessListener(nulla -> {
                            JSObject esito = new JSObject();
                            esito.put("attivi", recinti.size());
                            call.resolve(esito);
                        })
                        .addOnFailureListener(errore -> call.reject("registrazione-fallita: " + errore.getMessage()));
                } catch (SecurityException errore) {
                    call.reject("posizione-mancante");
                }
            });
    }

    @PluginMethod
    public void ferma(PluginCall call) {
        client.removeGeofences(intento());
        Luoghi.prefs(getContext()).edit().clear().apply();
        call.resolve();
    }
}
