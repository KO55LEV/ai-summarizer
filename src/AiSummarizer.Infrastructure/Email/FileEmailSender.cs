using System.Text.Json;
using AiSummarizer.Application.Emails;
using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Email.Models;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Email;

public sealed class FileEmailSender(IOptions<EmailFileDumpOptions> options)
{
    public async Task<EmailSendResult> SendAsync(EmailMessage message, EmailRuntimeSettingsDto emailSettings, CancellationToken cancellationToken)
    {
        if (message.To.Count == 0)
        {
            throw new ArgumentException("At least one recipient is required.", nameof(message));
        }

        if (message.HtmlBody is null && message.TextBody is null)
        {
            throw new ArgumentException("An email body is required.", nameof(message));
        }

        var from = ResolveSender(message, emailSettings);

        var dumpFolderPath = options.Value.FolderPath.Trim();
        if (dumpFolderPath.Length == 0)
        {
            throw new InvalidOperationException("Email:FileDump:FolderPath is required.");
        }

        var dumpDirectory = Path.GetFullPath(dumpFolderPath);
        Directory.CreateDirectory(dumpDirectory);

        var fileId = $"{DateTimeOffset.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.json";
        var filePath = Path.Combine(dumpDirectory, fileId);

        var payload = new
        {
            provider = "File",
            writtenAtUtc = DateTimeOffset.UtcNow,
            settings = new
            {
                provider = emailSettings.Provider,
                defaultFromEmail = emailSettings.DefaultFromEmail,
                defaultFromName = emailSettings.DefaultFromName
            },
            email = new
            {
                from,
                replyTo = message.ReplyTo,
                to = message.To,
                subject = message.Subject,
                htmlBody = message.HtmlBody,
                textBody = message.TextBody,
                tags = message.Tags
            }
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        });

        await File.WriteAllTextAsync(filePath, json, cancellationToken);

        return new EmailSendResult("File", filePath);
    }

    private static EmailAddress ResolveSender(EmailMessage message, EmailRuntimeSettingsDto emailSettings)
    {
        if (message.From is not null)
        {
            if (string.IsNullOrWhiteSpace(message.From.Email))
            {
                throw new InvalidOperationException("The message sender email is required.");
            }

            return message.From;
        }

        var defaultFromEmail = emailSettings.DefaultFromEmail.Trim();
        if (defaultFromEmail.Length == 0)
        {
            throw new InvalidOperationException("Email:DefaultFromEmail is required when the message does not provide a sender.");
        }

        return new EmailAddress(defaultFromEmail, emailSettings.DefaultFromName);
    }
}
