namespace AiSummarizer.Application.Emails;

public interface IEmailSender
{
    Task<EmailSendResult> SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

public interface IEmailTemplatesService
{
    Task<IReadOnlyList<EmailTemplateDto>> ListAsync(string? search, CancellationToken cancellationToken);
    Task<EmailTemplateDto?> GetAsync(string templateKey, CancellationToken cancellationToken);
    Task<EmailTemplateDto> CreateAsync(CreateEmailTemplateCommand command, CancellationToken cancellationToken);
    Task<EmailTemplateDto> UpdateAsync(string templateKey, UpdateEmailTemplateCommand command, CancellationToken cancellationToken);
    Task DeleteAsync(string templateKey, CancellationToken cancellationToken);
    Task<RenderedEmailTemplateDto> RenderAsync(string templateKey, IReadOnlyDictionary<string, string?> values, CancellationToken cancellationToken);
}

public interface IEmailTemplatesRepository
{
    Task<IReadOnlyList<EmailTemplateDto>> ListAsync(string? search, CancellationToken cancellationToken);
    Task<EmailTemplateDto?> GetByKeyAsync(string templateKey, CancellationToken cancellationToken);
    Task<EmailTemplateDto> CreateAsync(CreateEmailTemplateCommand command, CancellationToken cancellationToken);
    Task<EmailTemplateDto> UpdateAsync(string templateKey, UpdateEmailTemplateCommand command, CancellationToken cancellationToken);
    Task DeleteAsync(string templateKey, CancellationToken cancellationToken);
}
