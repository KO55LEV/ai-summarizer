select id, template_key, title, description, subject, html_body, text_body, is_active, created_at, updated_at
from email_templates
where template_key = @template_key;
