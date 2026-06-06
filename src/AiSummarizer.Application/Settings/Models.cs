namespace AiSummarizer.Application.Settings;

public sealed record UpSettingDto(
    string SettingKey,
    string SettingJson,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record EmailRuntimeSettingsDto(
    string Provider,
    string DefaultFromEmail,
    string? DefaultFromName);

public sealed record TranscribeRuntimeSettingsDto(
    string Provider);

public sealed record AdminSettingsDto(
    EmailRuntimeSettingsDto Email,
    TranscribeRuntimeSettingsDto Transcribe);

public sealed record UpdateEmailRuntimeSettingsCommand(
    string Provider,
    string DefaultFromEmail,
    string? DefaultFromName);

public sealed record UpdateTranscribeRuntimeSettingsCommand(
    string Provider);

public sealed record UpdateAdminSettingsCommand(
    UpdateEmailRuntimeSettingsCommand Email,
    UpdateTranscribeRuntimeSettingsCommand Transcribe);
