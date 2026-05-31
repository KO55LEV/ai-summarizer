select
    @prompt_id::uuid as prompt_id,
    count(*)::int as total_runs,
    count(*) filter (where pr.status = 'succeeded')::int as succeeded_runs,
    count(*) filter (where pr.status = 'failed')::int as failed_runs,
    count(*) filter (where pr.status = 'running')::int as running_runs,
    max(pr.created_at) as last_run_at,
    (
        array_agg(pr.status order by pr.created_at desc)
    )[1] as last_status
from prompt_runs pr
where pr.prompt_id = @prompt_id;
