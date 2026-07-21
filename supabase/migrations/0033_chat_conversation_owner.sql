-- O chat da Atendente IA é do portal do cliente, mas o dono/staff (que existe
-- em platform_users, não em public.users) precisa conseguir testar o próprio
-- portal. A FK de chat_conversations.user_id apontava para public.users, então
-- criar conversa como dono violava a FK e a rota respondia 500.
--
-- Passa a referenciar auth.users(id): todo public.users.id já é um auth.users.id
-- (public.users.id references auth.users.id), então as conversas já existentes
-- continuam válidas. A autorização de tenant continua na rota /api/chat.

alter table public.chat_conversations
  drop constraint if exists chat_conversations_user_id_fkey;

alter table public.chat_conversations
  add constraint chat_conversations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
