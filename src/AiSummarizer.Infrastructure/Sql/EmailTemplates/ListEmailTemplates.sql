select id, template_key, title, description, subject, html_body, text_body, is_active, created_at, updated_at
from email_templates
where (
    @search_value is null
    or lower(template_key) like '%' || lower(@search_value) || '%'
    or lower(title) like '%' || lower(@search_value) || '%'
    or lower(coalesce(description, '')) like '%' || lower(@search_value) || '%'
    or lower(subject) like '%' || lower(@search_value) || '%'
)
order by created_at desc;
