-- Prima creare nel Vault i secret giorno_project_url e giorno_cron_secret.
-- Il valore giorno_cron_secret deve coincidere con GIORNO_CRON_SECRET negli Edge secrets.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('giorno-push-every-minute','* * * * *',$$
select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='giorno_project_url')||'/functions/v1/giorno-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-giorno-secret',(select decrypted_secret from vault.decrypted_secrets where name='giorno_cron_secret')),
 body:='{}'::jsonb
);
$$);
