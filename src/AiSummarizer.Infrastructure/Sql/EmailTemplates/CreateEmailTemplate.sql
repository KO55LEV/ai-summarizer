insert into email_templates (
    template_key,
    title,
    description,
    subject,
    html_body,
    text_body,
    is_active
)
values (
    @template_key,
    @title,
    @description,
    @subject,
    @html_body,
    @text_body,
    @is_active
)
returning id, template_key, title, description, subject, html_body, text_body, is_active, created_at, updated_at;
