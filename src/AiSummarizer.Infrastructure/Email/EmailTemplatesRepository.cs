using AiSummarizer.Application.Emails;
using AiSummarizer.Infrastructure.Persistence;
using Npgsql;

namespace AiSummarizer.Infrastructure.Email;

public sealed class EmailTemplatesRepository(NpgsqlDataSource dataSource, ISqlScriptLoader sqlScriptLoader) : IEmailTemplatesRepository
{
    public Task<IReadOnlyList<EmailTemplateDto>> ListAsync(string? search, CancellationToken cancellationToken)
        => QueryManyAsync("EmailTemplates/ListEmailTemplates.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("search_value", (object?)search ?? DBNull.Value);
        }, cancellationToken);

    public Task<EmailTemplateDto?> GetByKeyAsync(string templateKey, CancellationToken cancellationToken)
        => QuerySingleOrDefaultAsync("EmailTemplates/GetEmailTemplateByKey.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("template_key", templateKey);
        }, cancellationToken);

    public Task<EmailTemplateDto> CreateAsync(CreateEmailTemplateCommand command, CancellationToken cancellationToken)
        => ExecuteWithConflictTranslationAsync(() => QuerySingleAsync("EmailTemplates/CreateEmailTemplate.sql", cmd => BindCreate(cmd, command), cancellationToken));

    public async Task<EmailTemplateDto> UpdateAsync(string templateKey, UpdateEmailTemplateCommand command, CancellationToken cancellationToken)
    {
        var updated = await QuerySingleOrDefaultAsync("EmailTemplates/UpdateEmailTemplate.sql", cmd =>
        {
            cmd.Parameters.AddWithValue("template_key", templateKey);
            BindUpdate(cmd, command);
        }, cancellationToken);

        return updated ?? throw new EmailTemplateNotFoundException("Email template not found.");
    }

    public async Task DeleteAsync(string templateKey, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load("EmailTemplates/DeleteEmailTemplate.sql"), connection);
        command.Parameters.AddWithValue("template_key", templateKey);

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        if (rowsAffected == 0)
        {
            throw new EmailTemplateNotFoundException("Email template not found.");
        }
    }

    private async Task<IReadOnlyList<EmailTemplateDto>> QueryManyAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<EmailTemplateDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(Map(reader));
        }

        return items;
    }

    private async Task<EmailTemplateDto?> QuerySingleOrDefaultAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sqlScriptLoader.Load(sqlPath), connection);
        configure(command);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? Map(reader) : null;
    }

    private async Task<EmailTemplateDto> QuerySingleAsync(string sqlPath, Action<NpgsqlCommand> configure, CancellationToken cancellationToken)
    {
        var item = await QuerySingleOrDefaultAsync(sqlPath, configure, cancellationToken);
        return item ?? throw new InvalidOperationException($"No rows returned for {sqlPath}.");
    }

    private static async Task<EmailTemplateDto> ExecuteWithConflictTranslationAsync(Func<Task<EmailTemplateDto>> action)
    {
        try
        {
            return await action();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new EmailTemplateConflictException("An email template with this key already exists.");
        }
    }

    private static void BindCreate(NpgsqlCommand command, CreateEmailTemplateCommand commandModel)
    {
        command.Parameters.AddWithValue("template_key", commandModel.TemplateKey);
        command.Parameters.AddWithValue("title", commandModel.Title);
        command.Parameters.AddWithValue("description", (object?)commandModel.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("subject", commandModel.Subject);
        command.Parameters.AddWithValue("html_body", (object?)commandModel.HtmlBody ?? DBNull.Value);
        command.Parameters.AddWithValue("text_body", (object?)commandModel.TextBody ?? DBNull.Value);
        command.Parameters.AddWithValue("is_active", commandModel.IsActive);
    }

    private static void BindUpdate(NpgsqlCommand command, UpdateEmailTemplateCommand commandModel)
    {
        command.Parameters.AddWithValue("title", commandModel.Title);
        command.Parameters.AddWithValue("description", (object?)commandModel.Description ?? DBNull.Value);
        command.Parameters.AddWithValue("subject", commandModel.Subject);
        command.Parameters.AddWithValue("html_body", (object?)commandModel.HtmlBody ?? DBNull.Value);
        command.Parameters.AddWithValue("text_body", (object?)commandModel.TextBody ?? DBNull.Value);
        command.Parameters.AddWithValue("is_active", commandModel.IsActive);
    }

    private static EmailTemplateDto Map(NpgsqlDataReader reader)
        => new(
            reader.GetGuid(reader.GetOrdinal("id")),
            reader.GetString(reader.GetOrdinal("template_key")),
            reader.GetString(reader.GetOrdinal("title")),
            reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString(reader.GetOrdinal("description")),
            reader.GetString(reader.GetOrdinal("subject")),
            reader.IsDBNull(reader.GetOrdinal("html_body")) ? null : reader.GetString(reader.GetOrdinal("html_body")),
            reader.IsDBNull(reader.GetOrdinal("text_body")) ? null : reader.GetString(reader.GetOrdinal("text_body")),
            reader.GetBoolean(reader.GetOrdinal("is_active")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("created_at")),
            reader.GetFieldValue<DateTimeOffset>(reader.GetOrdinal("updated_at")));
}
