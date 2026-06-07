namespace AiSummarizer.Application.Emails;

public sealed class EmailTemplatesService(IEmailTemplatesRepository repository) : IEmailTemplatesService
{
    public async Task<IReadOnlyList<EmailTemplateDto>> ListAsync(string? search, CancellationToken cancellationToken)
        => await repository.ListAsync(NormalizeNullable(search), cancellationToken);

    public async Task<EmailTemplateDto?> GetAsync(string templateKey, CancellationToken cancellationToken)
        => await repository.GetByKeyAsync(NormalizeKey(templateKey), cancellationToken);

    public async Task<EmailTemplateDto> CreateAsync(CreateEmailTemplateCommand command, CancellationToken cancellationToken)
    {
        Validate(command.Title, command.Subject, command.HtmlBody, command.TextBody);

        return await repository.CreateAsync(
            new CreateEmailTemplateCommand(
                NormalizeKey(command.TemplateKey),
                command.Title.Trim(),
                NormalizeNullable(command.Description),
                command.Subject.Trim(),
                NormalizeNullable(command.HtmlBody),
                NormalizeNullable(command.TextBody),
                command.IsActive),
            cancellationToken);
    }

    public async Task<EmailTemplateDto> UpdateAsync(string templateKey, UpdateEmailTemplateCommand command, CancellationToken cancellationToken)
    {
        Validate(command.Title, command.Subject, command.HtmlBody, command.TextBody);

        return await repository.UpdateAsync(
            NormalizeKey(templateKey),
            new UpdateEmailTemplateCommand(
                command.Title.Trim(),
                NormalizeNullable(command.Description),
                command.Subject.Trim(),
                NormalizeNullable(command.HtmlBody),
                NormalizeNullable(command.TextBody),
                command.IsActive),
            cancellationToken);
    }

    public async Task DeleteAsync(string templateKey, CancellationToken cancellationToken)
        => await repository.DeleteAsync(NormalizeKey(templateKey), cancellationToken);

    public async Task<RenderedEmailTemplateDto> RenderAsync(string templateKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken)
    {
        var template = await repository.GetByKeyAsync(NormalizeKey(templateKey), cancellationToken)
            ?? throw new EmailTemplateNotFoundException("Email template not found.");

        if (!template.IsActive)
        {
            throw new EmailTemplateNotFoundException("Email template not found.");
        }

        return new RenderedEmailTemplateDto(
            ReplaceTokens(template.Subject, values) ?? template.Subject,
            ReplaceTokens(template.HtmlBody, values),
            ReplaceTokens(template.TextBody, values));
    }

    private static void Validate(string title, string subject, string? htmlBody, string? textBody)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Email template title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new ArgumentException("Email template subject is required.", nameof(subject));
        }

        if (string.IsNullOrWhiteSpace(htmlBody) && string.IsNullOrWhiteSpace(textBody))
        {
            throw new ArgumentException("Email template body is required.", nameof(htmlBody));
        }
    }

    private static string? ReplaceTokens(string? template, IReadOnlyDictionary<string, string?> values)
    {
        if (template is null)
        {
            return null;
        }

        var rendered = template;
        foreach (var (key, value) in values)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            rendered = rendered.Replace($"{{{{{key}}}}}", value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        return rendered;
    }

    private static string NormalizeKey(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length == 0)
        {
            throw new ArgumentException("Template key is required.", nameof(value));
        }

        return normalized;
    }

    private static string? NormalizeNullable(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
