-- Correct a runtime-only PL/pgSQL ambiguity without rewriting migration 008.
-- The per-function compiler directive is supported without elevated database
-- configuration privileges and makes the intended command variables explicit.

do $migration$
declare
  function_definition text;
  corrected_definition text;
  function_signature regprocedure;
begin
  foreach function_signature in array array[
    'public.create_service_request_draft(uuid,jsonb,text,text)'::regprocedure,
    'public.update_service_request_draft(uuid,uuid,integer,jsonb)'::regprocedure
  ]
  loop
    select pg_get_functiondef(function_signature) into function_definition;
    corrected_definition := replace(
      function_definition,
      E'AS $function$\n',
      E'AS $function$\n#variable_conflict use_variable\n'
    );
    if corrected_definition = function_definition then
      raise exception 'Could not add the PL/pgSQL variable-resolution directive.';
    end if;
    execute corrected_definition;
  end loop;
end;
$migration$;
