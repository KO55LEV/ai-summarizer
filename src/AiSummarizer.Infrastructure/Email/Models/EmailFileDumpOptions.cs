namespace AiSummarizer.Infrastructure.Email.Models;

public sealed class EmailFileDumpOptions
{
    public const string SectionName = "Email:FileDump";

    public string FolderPath { get; set; } = "./data/email-outbox";
}
