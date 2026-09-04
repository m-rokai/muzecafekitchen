drop policy kitchen_staff_receive_broadcasts on realtime.messages;

create policy kitchen_staff_receive_broadcasts
on realtime.messages for select
to authenticated
using (
  (select realtime.topic()) = 'kitchen'
  and realtime.messages.extension = 'broadcast'
  and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') in ('staff', 'admin')
);
