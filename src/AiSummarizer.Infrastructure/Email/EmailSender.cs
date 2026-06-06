using AiSummarizer.Application.Emails;
using AiSummarizer.Infrastructure.Email.Models;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Email;

public sealed class EmailSender(
    BrevoEmailSender brevoEmailSender,
    IOptions<EmailOptions> options) : IEmailSender
{
    public Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken)
        => options.Value.Provider switch
        {
            EmailProvider.Brevo => brevoEmailSender.SendAsync(message, cancellationToken),
            EmailProvider.Resend => throw new NotSupportedException("Resend is not implemented yet."),
            EmailProvider.MailerSend => throw new NotSupportedException("MailerSend is not implemented yet."),
            EmailProvider.Postmark => throw new NotSupportedException("Postmark is not implemented yet."),
            EmailProvider.SendGrid => throw new NotSupportedException("SendGrid is not implemented yet."),
            EmailProvider.Ses => throw new NotSupportedException("Amazon SES is not implemented yet."),
            _ => throw new NotSupportedException($"Email provider '{options.Value.Provider}' is not supported.")
        };
}
