using AiSummarizer.Application.Research;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Research;

[ApiController]
[Route("api/search-providers")]
public sealed class SearchProvidersController(ISearchProviderRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SearchProviderKeyDto>>> List(CancellationToken cancellationToken)
        => Ok(await repository.ListKeysAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SearchProviderKeyDto>> Get([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var key = await repository.GetKeyAsync(id, cancellationToken);
        return key is null ? NotFound() : Ok(key);
    }

    [HttpGet("{id:guid}/usage")]
    public async Task<ActionResult<SearchProviderUsageDto>> GetUsage([FromRoute] Guid id, CancellationToken cancellationToken)
        => Ok(await repository.GetUsageAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<SearchProviderKeyDto>> Create([FromBody] SearchProviderKeyDto request, CancellationToken cancellationToken)
    {
        var created = await repository.CreateKeyAsync(request with { Id = Guid.NewGuid() }, cancellationToken);
        return Ok(created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SearchProviderKeyDto>> Update([FromRoute] Guid id, [FromBody] SearchProviderKeyDto request, CancellationToken cancellationToken)
    {
        var updated = await repository.UpdateKeyAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await repository.DeleteKeyAsync(id, cancellationToken);
        return NoContent();
    }

}
