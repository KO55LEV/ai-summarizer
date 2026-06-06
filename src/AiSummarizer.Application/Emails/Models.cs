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
