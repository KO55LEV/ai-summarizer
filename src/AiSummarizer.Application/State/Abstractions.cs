using System.Text.Json;

namespace AiSummarizer.Application.State;

public interface IAppStateRepository
{
    Task<JsonElement?> GetStateAsync(string stateKey, CancellationToken cancellationToken);
    Task UpsertStateAsync(string stateKey, JsonElement state, CancellationToken cancellationToken);
}
