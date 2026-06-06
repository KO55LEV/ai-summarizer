using System.Text.Json;
using AiSummarizer.Application.Settings;
using AiSummarizer.Infrastructure.Settings.Models;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Settings;

public sealed class AdminSettingsService(
    IUpSettingsRepository upSettingsRepository,
    IOptions<EmailRuntimeDefaultsOptions> emailDefaults,
    IOptions<TranscribeRuntimeDefaultsOptions> transcribeDefaults) : IAdminSettingsService
{
    private const string EmailSettingKey = "email";
    private const string TranscribeSettingKey = "transcribe";

    public async Task<AdminSettingsDto> GetAsync(CancellationToken cancellationToken)
    {
        var email = await ReadEmailAsync(cancellationToken);
        var transcribe = await ReadTranscribeAsync(cancellationToken);
        return new AdminSettingsDto(email, transcribe);
    }

    public async Task<AdminSettingsDto> UpdateAsync(UpdateAdminSettingsCommand command, CancellationToken cancellationToken)
    {
        Validate(command);

        await upSettingsRepository.UpsertAsync(
            EmailSettingKey,
            JsonSerializer.Serialize(new
            {
                provider = command.Email.Provider.Trim(),
                defaultFromEmail = command.Email.DefaultFromEmail.Trim(),
                defaultFromName = NormalizeNullable(command.Email.DefaultFromName)
            }),
            cancellationToken);

        await upSettingsRepository.UpsertAsync(
            TranscribeSettingKey,
            JsonSerializer.Serialize(new
            {
                provider = command.Transcribe.Provider.Trim()
            }),
            cancellationToken);

        return await GetAsync(cancellationToken);
    }

    private async Task<EmailRuntimeSettingsDto> ReadEmailAsync(CancellationToken cancellationToken)
    {
        var setting = await upSettingsRepository.GetAsync(EmailSettingKey, cancellationToken);
        if (setting is null)
        {
            return new EmailRuntimeSettingsDto(
                emailDefaults.Value.Provider,
                emailDefaults.Value.DefaultFromEmail,
                emailDefaults.Value.DefaultFromName);
        }

        using var document = JsonDocument.Parse(setting.SettingJson);
        var root = document.RootElement;
        return new EmailRuntimeSettingsDto(
            ReadString(root, "provider") ?? emailDefaults.Value.Provider,
            ReadString(root, "defaultFromEmail") ?? emailDefaults.Value.DefaultFromEmail,
            ReadNullableString(root, "defaultFromName") ?? emailDefaults.Value.DefaultFromName);
    }

    private async Task<TranscribeRuntimeSettingsDto> ReadTranscribeAsync(CancellationToken cancellationToken)
    {
        var setting = await upSettingsRepository.GetAsync(TranscribeSettingKey, cancellationToken);
        if (setting is null)
        {
            return new TranscribeRuntimeSettingsDto(transcribeDefaults.Value.Provider);
        }

        using var document = JsonDocument.Parse(setting.SettingJson);
        var root = document.RootElement;
        return new TranscribeRuntimeSettingsDto(ReadString(root, "provider") ?? transcribeDefaults.Value.Provider);
    }

    private static void Validate(UpdateAdminSettingsCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.Email.DefaultFromEmail))
        {
            throw new ArgumentException("Email default from address is required.", nameof(command));
        }

        if (string.IsNullOrWhiteSpace(command.Email.Provider))
        {
            throw new ArgumentException("Email provider is required.", nameof(command));
        }

        if (string.IsNullOrWhiteSpace(command.Transcribe.Provider))
        {
            throw new ArgumentException("Transcribe provider is required.", nameof(command));
        }
    }

    private static string? ReadString(JsonElement element, string propertyName)
        => element.TryGetProperty(propertyName, out var prop) ? prop.GetString() : null;

    private static string? ReadNullableString(JsonElement element, string propertyName)
    {
        var value = ReadString(element, propertyName);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? NormalizeNullable(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }
}
