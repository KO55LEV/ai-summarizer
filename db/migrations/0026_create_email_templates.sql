create table if not exists email_templates (
    id uuid primary key default gen_random_uuid(),
    template_key text not null,
    title text not null,
    description text null,
    subject text not null,
    html_body text null,
    text_body text null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_email_templates_key_format check (length(trim(template_key)) > 0 and template_key = lower(template_key)),
    constraint ck_email_templates_title check (length(trim(title)) > 0),
    constraint ck_email_templates_subject check (length(trim(subject)) > 0),
    constraint ck_email_templates_body check (
        (html_body is not null and length(trim(html_body)) > 0)
        or
        (text_body is not null and length(trim(text_body)) > 0)
    ),
    constraint ux_email_templates_key unique (template_key)
);

create index if not exists ix_email_templates_title
    on email_templates (title);

drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at
before update on email_templates
for each row
execute function set_updated_at();

insert into email_templates (template_key, title, description, subject, html_body, text_body, is_active)
values (
    'email.welcome',
    'Welcome email',
    'Sent when a new user signs up.',
    'Welcome to Ai Summarizer',
    '<div style="font-family: Inter, Arial, sans-serif; color: #e5eefc; background: #081122; padding: 32px;"><div style="max-width: 640px; margin: 0 auto; background: #0b172b; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px;"><h1 style="margin: 0 0 16px; font-size: 28px;">Welcome, {{displayName}}!</h1><p style="margin: 0 0 14px; line-height: 1.6;">Your Ai Summarizer account is ready.</p><p style="margin: 0 0 14px; line-height: 1.6;">You can now organize research, generate summaries, and keep everything in one workspace.</p><p style="margin: 24px 0 0; line-height: 1.6; color: #8aa0bd;">If you did not create this account, you can ignore this message.</p></div></div>',
    'Welcome, {{displayName}}! Your Ai Summarizer account is ready. You can now organize research, generate summaries, and keep everything in one workspace. If you did not create this account, you can ignore this message.',
    true
)
on conflict (template_key)
do update set
    title = excluded.title,
    description = excluded.description,
    subject = excluded.subject,
    html_body = excluded.html_body,
    text_body = excluded.text_body,
    is_active = excluded.is_active;
