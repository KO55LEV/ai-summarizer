namespace AiSummarizer.Worker;

public sealed class TelegramOptions
{
    public string BotToken { get; set; } = string.Empty;
    public string ApiBaseUrl { get; set; } = "https://api.telegram.org/";
    public int PollIntervalSeconds { get; set; } = 5;
    public int MaxUpdatesPerPoll { get; set; } = 50;
    public string StateKey { get; set; } = "telegram.polling";
    public double RoutingConfidenceThreshold { get; set; } = 0.78;
    public bool PolishEnabled { get; set; } = false;
    public string? PolishProvider { get; set; }
    public string? PolishModel { get; set; }
    public string? PolishPromptVersion { get; set; }
    public int PolishMaxTokens { get; set; } = 512;
    public double PolishTemperature { get; set; } = 0.2;
}
