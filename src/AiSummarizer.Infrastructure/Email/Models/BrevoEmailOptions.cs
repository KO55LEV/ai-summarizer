namespace AiSummarizer.Infrastructure.Email.Models;

public sealed class BrevoEmailOptions
{
    public const string SectionName = "Email:Brevo";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.brevo.com";
    public int TimeoutSeconds { get; set; } = 60;
}
