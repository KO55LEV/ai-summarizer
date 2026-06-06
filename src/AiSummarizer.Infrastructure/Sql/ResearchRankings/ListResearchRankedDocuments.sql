select rd.id,
       rd.research_ranking_run_id,
       rd.research_topic_run_id,
       rd.research_topic_id,
       rd.research_document_id,
       rd.source_key,
       rd.title,
       rd.canonical_url,
       rd.score,
       rd.freshness_score,
       rd.source_weight,
       rd.length_score,
       rd.rank_position,
       rd.is_selected,
       rd.reason_json,
       rd.created_at,
       rd.updated_at
from research_ranked_documents rd
where rd.research_topic_run_id = @research_topic_run_id
order by rd.rank_position asc, rd.created_at asc
limit @limit_value offset @offset_value;
