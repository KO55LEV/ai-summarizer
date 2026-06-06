namespace AiSummarizer.Application.Settings;

public interface IAdminSettingsService
{
    Task<AdminSettingsDto> GetAsync(CancellationToken cancellationToken);
    Task<AdminSettingsDto> UpdateAsync(UpdateAdminSettingsCommand command, CancellationToken cancellationToken);
}

public interface IUpSettingsRepository
{
    Task<UpSettingDto?> GetAsync(string settingKey, CancellationToken cancellationToken);
    Task<UpSettingDto> UpsertAsync(string settingKey, string settingJson, CancellationToken cancellationToken);
}
