using AiSummarizer.Application.Emails;
using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Email.Models;

namespace AiSummarizer.Infrastructure.Email;

public sealed class EmailSender(
    BrevoEmailSender brevoEmailSender,
    FileEmailSender fileEmailSender,
    IAdminSettingsService adminSettingsService) : IEmailSender
{
    public Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken)
        => RouteAsync(message, cancellationToken);

    private async Task<EmailSendResult> RouteAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var settings = await adminSettingsService.GetAsync(cancellationToken);
        return settings.Email.Provider.Trim().ToLowerInvariant() switch
        {
            "brevo" => await brevoEmailSender.SendAsync(message, settings.Email, cancellationToken),
            "file" => await fileEmailSender.SendAsync(message, settings.Email, cancellationToken),
            "resend" => throw new NotSupportedException("Resend is not implemented yet."),
            "mailersend" => throw new NotSupportedException("MailerSend is not implemented yet."),
            "postmark" => throw new NotSupportedException("Postmark is not implemented yet."),
            "sendgrid" => throw new NotSupportedException("SendGrid is not implemented yet."),
            "ses" => throw new NotSupportedException("Amazon SES is not implemented yet."),
            _ => throw new NotSupportedException($"Email provider '{settings.Email.Provider}' is not supported.")
        };
    }
}
