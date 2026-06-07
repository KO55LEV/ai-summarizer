update email_templates
set
    title = @title,
    description = @description,
    subject = @subject,
    html_body = @html_body,
    text_body = @text_body,
    is_active = @is_active
where template_key = @template_key
returning id, template_key, title, description, subject, html_body, text_body, is_active, created_at, updated_at;
