namespace AiSummarizer.Application.Emails;

public interface IEmailSender
{
    Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
