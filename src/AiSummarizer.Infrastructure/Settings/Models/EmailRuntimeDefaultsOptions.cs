namespace AiSummarizer.Infrastructure.Settings.Models;

public sealed class EmailRuntimeDefaultsOptions
{
    public const string SectionName = "Email";

    public string Provider { get; set; } = "Brevo";
    public string DefaultFromEmail { get; set; } = string.Empty;
    public string? DefaultFromName { get; set; }
}
