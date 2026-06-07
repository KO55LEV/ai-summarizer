namespace AiSummarizer.Application.Emails;

public sealed record EmailAddress(
    string Email,
    string? Name = null);

public sealed record EmailMessage(
    IReadOnlyList<EmailAddress> To,
    string Subject,
    string? HtmlBody = null,
    string? TextBody = null,
    EmailAddress? From = null,
    EmailAddress? ReplyTo = null,
    IReadOnlyList<string>? Tags = null);

public sealed record EmailSendResult(
    string Provider,
    string MessageId);

public sealed record EmailTemplateDto(
    Guid Id,
    string TemplateKey,
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateEmailTemplateCommand(
    string TemplateKey,
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive);

public sealed record UpdateEmailTemplateCommand(
    string Title,
    string? Description,
    string Subject,
    string? HtmlBody,
    string? TextBody,
    bool IsActive);

public sealed record RenderedEmailTemplateDto(
    string Subject,
    string? HtmlBody,
    string? TextBody);
