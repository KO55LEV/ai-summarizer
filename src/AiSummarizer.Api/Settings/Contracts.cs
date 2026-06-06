namespace AiSummarizer.Api.Settings;

public sealed record AdminSettingsResponse(
    EmailSettingsResponse Email,
    TranscribeSettingsResponse Transcribe);

public sealed record EmailSettingsResponse(
    string Provider,
    string DefaultFromEmail,
    string? DefaultFromName);

public sealed record TranscribeSettingsResponse(
    string Provider);

public sealed record UpdateAdminSettingsRequest(
    EmailSettingsRequest Email,
    TranscribeSettingsRequest Transcribe);

public sealed record EmailSettingsRequest(
    string Provider,
    string DefaultFromEmail,
    string? DefaultFromName);

public sealed record TranscribeSettingsRequest(
    string Provider);
