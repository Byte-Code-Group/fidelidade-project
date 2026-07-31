-- Uma missão só pode ser concluída uma vez por cliente.
--
-- A checagem existia só no código (SELECT antes do INSERT), que não segura
-- dois cliques simultâneos: os dois liam "não concluída" e os dois inseriam,
-- creditando a recompensa em dobro.
--
-- Limpa as duplicatas já existentes (mantém a primeira de cada par) antes de
-- criar o índice, senão a criação falha.
delete from public.mission_completions a
using public.mission_completions b
where a.mission_id = b.mission_id
  and a.user_id = b.user_id
  and a.ctid > b.ctid;

create unique index if not exists mission_completions_mission_user_key
  on public.mission_completions (mission_id, user_id);
