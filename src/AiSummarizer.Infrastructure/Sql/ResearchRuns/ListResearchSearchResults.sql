select id, research_search_run_id, research_topic_run_id, research_topic_id, source_key, query, title, url, canonical_url, snippet, score, published_at, author_name, domain, language, result_rank, raw_result_json, created_at, updated_at
from research_search_results
where research_topic_run_id = @research_topic_run_id
order by result_rank asc, created_at asc
limit @limit_value offset @offset_value;
