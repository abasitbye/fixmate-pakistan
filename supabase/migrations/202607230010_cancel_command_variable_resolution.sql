-- Apply explicit PL/pgSQL variable precedence to the cancellation command,
-- whose reason parameter intentionally maps to the same-named column.

do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.cancel_service_request(uuid,uuid,integer,text,text,text)'::regprocedure
  ) into function_definition;
  corrected_definition := replace(
    function_definition,
    E'AS $function$\n',
    E'AS $function$\n#variable_conflict use_variable\n'
  );
  if corrected_definition = function_definition then
    raise exception 'Could not add the PL/pgSQL variable-resolution directive.';
  end if;
  execute corrected_definition;
end;
$migration$;
