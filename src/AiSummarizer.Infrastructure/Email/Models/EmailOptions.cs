namespace AiSummarizer.Infrastructure.Email.Models;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public EmailProvider Provider { get; set; } = EmailProvider.Brevo;
    public string DefaultFromEmail { get; set; } = string.Empty;
    public string? DefaultFromName { get; set; }
}
