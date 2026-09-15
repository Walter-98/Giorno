# Attivazione famiglia e notifiche

La versione locale funziona già. Famiglia online e Web Push richiedono un servizio configurato; i pulsanti lo dichiarano finché mancano i valori in `dist/cloud-config.js`.

## Famiglia online

1. Scegliere un progetto Supabase. È possibile usare quello di Tasca: tutte le nuove tabelle e funzioni sono prefissate `giorno_` e non cambiano le tabelle di Tasca.
2. Eseguire `setup.sql` nel SQL Editor del progetto. Richiede il proprietario/amministratore del progetto.
3. Inserire URL e publishable key in `dist/cloud-config.js`. Non inserire service_role.
4. In Authentication, abilitare email/password e conferma email. Configurare URL del sito e redirect autorizzati. Con un progetto condiviso non sostituire gli URL già usati da Tasca: aggiungere quello di Giorno ai redirect consentiti. Configurare il modello/email di conferma secondo la destinazione desiderata.
5. Il link Sites corrente è privato del proprietario: non consente da solo l’accesso ai familiari. Prima del test su due account, il proprietario deve autorizzare i familiari all’accesso al sito o scegliere una pubblicazione accessibile dall’esterno (ad esempio GitHub Pages) mantenendo l’autenticazione e le regole del database.
6. Registrare due account di prova, confermare le email, creare una famiglia e usare il codice monouso con il secondo account. Il codice dura 24 ore; un nuovo invito revoca il precedente. Un massimo di dieci membri è imposto dal database.
7. Verificare che una terza persona non appartenente alla famiglia non veda né modifichi le voci. Le tabelle non sono accessibili direttamente ai client: le funzioni verificano l’identità e l’appartenenza sul server.

Le faccende condivise compaiono direttamente nella scheda Famiglia, con l’etichetta “Condivisa”, e si aggiornano ogni dieci secondi mentre quella scheda è aperta. La lista della spesa è stata tolta dall’app (set 2026): le vecchie voci con kind='shop' restano nel database ma non sono più mostrate; per eliminarle definitivamente: `delete from public.giorno_items where kind='shop';`. Portano solo titolo, persona e stato: data, ripetizione e preavviso restano sul dispositivo che le ha create. Le liste condivise sono separate da quelle personali. Non viene caricato automaticamente il programma privato. La sincronizzazione si aggiorna ogni dieci secondi mentre la lista è aperta. Le scritture richiedono connessione; i conflitti tra modifiche simultanee vengono rifiutati invece di sovrascrivere dati. L’amministratore può revocare un membro; i membri possono lasciare il gruppo. Per rimuovere il creatore serve una futura funzione di trasferimento proprietà.

## Web Push

1. Eseguire `push.sql` dopo `setup.sql`.
2. Le chiavi VAPID sono già state generate (set 2026) e si trovano in `backend/SEGRETI-non-condividere.txt`, escluso dal repository. La chiave pubblica è già scritta in `dist/cloud-config.js`; la privata va solo negli Edge Function secrets.
3. Configurare gli Edge secrets copiandoli dal file dei segreti: `GIORNO_VAPID_PUBLIC`, `GIORNO_VAPID_PRIVATE`, `GIORNO_VAPID_SUBJECT`, `GIORNO_CRON_SECRET`. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono forniti automaticamente alle Edge Functions di Supabase.
4. Pubblicare `supabase/functions/giorno-push` usando la CLI Supabase o la dashboard. `verify_jwt=false` è specifico per questa funzione: ogni chiamata viene comunque autenticata tramite il segreto `x-giorno-secret` confrontato dalla funzione.
5. Nel Vault creare `giorno_project_url` e `giorno_cron_secret` (quest’ultimo identico al secret della funzione). Eseguire `schedule.sql`: il servizio controlla gli avvisi ogni minuto. Non creare più job con nomi diversi.
6. La chiave VAPID pubblica è già in `dist/cloud-config.js`: basta pubblicare il sito.
7. Accedere nell’app, aprire Promemoria e attivare su ciascun telefono. Su iPhone è richiesta l’app aggiunta alla schermata Home e una versione compatibile con Web Push.
8. Test indispensabili prima di dichiarare il servizio attivo: richiesta senza segreto restituisce 401; cron esegue la funzione; avviso di prova arriva ad app chiusa su Android e iPhone; modifica/cancellazione aggiorna la coda; revoca ed uscita disattivano l’iscrizione del dispositivo.

L’attivazione carica sul servizio i titoli e gli orari dei blocchi personali necessari agli avvisi: aggiungere una spiegazione/consenso coerente con l’informativa prima della distribuzione pubblica. Gli avvisi coprono i blocchi con orario e le scadenze di famiglia con preavviso (alle 8:30 del giorno di preavviso). Sono preparati fino a 250 avvisi nei prossimi sette giorni; riaprire Giorno aggiorna la coda. Una modifica offline non può aggiornare subito un avviso online già pianificato. Il cron può introdurre un ritardo fino a circa un minuto, oltre ai tempi del servizio push. I tentativi vengono limitati, le iscrizioni scadute rimosse e le notifiche con lo stesso tag raggruppate; le consegne non sono garantite dal sistema operativo.

Riferimenti: https://supabase.com/docs/guides/functions/schedule-functions e https://github.com/web-push-libs/web-push.

## Stato di verifica

Verificati localmente: sintassi JavaScript, regole di pianificazione, parsing rapido, ricorrenze mensili e annuali, preavvisi, routine, import .ics, resoconto e compatibilità del salvataggio locale (15 test in `tests/`, più una prova d’uso completa in browser). SQL, autenticazione, sincronizzazione e consegna Web Push richiedono i test d’integrazione sul progetto configurato: non sono ancora stati eseguiti.
