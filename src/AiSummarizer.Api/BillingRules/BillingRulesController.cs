using AiSummarizer.Api.Users;
using AiSummarizer.Application.Billing;
using AiSummarizer.Application.Users;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.BillingRules;

[ApiController]
[Route("api/admin/billing-rules")]
public sealed class BillingRulesController(IBillingService billingService, IUsersService usersService) : AdminAccessControllerBase(usersService)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BillingRuleResponse>>> List(CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok((await billingService.ListRulesAsync(cancellationToken)).Select(Map).ToArray());
    }

    [HttpGet("{ruleId:guid}")]
    public async Task<ActionResult<BillingRuleResponse>> Get([FromRoute] Guid ruleId, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        var rule = await billingService.GetRuleAsync(ruleId, cancellationToken);
        return rule is null ? NotFound(new { status = StatusCodes.Status404NotFound, detail = "Billing rule not found." }) : Ok(Map(rule));
    }

    [HttpPost]
    public async Task<ActionResult<BillingRuleResponse>> Create([FromBody] CreateBillingRuleRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await billingService.CreateRuleAsync(new CreateBillingRuleCommand(
            request.ActionType,
            request.Provider,
            request.Model,
            request.Version,
            request.UnitType,
            request.BaseFeeCredits,
            request.RatePerUnitCredits,
            request.MinCredits,
            request.MaxCredits,
            request.Multiplier,
            request.IsActive,
            request.EffectiveFrom), cancellationToken)));
    }

    [HttpPut("{ruleId:guid}")]
    public async Task<ActionResult<BillingRuleResponse>> Update([FromRoute] Guid ruleId, [FromBody] UpdateBillingRuleRequest request, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        return Ok(Map(await billingService.UpdateRuleAsync(ruleId, new UpdateBillingRuleCommand(
            request.ActionType,
            request.Provider,
            request.Model,
            request.Version,
            request.UnitType,
            request.BaseFeeCredits,
            request.RatePerUnitCredits,
            request.MinCredits,
            request.MaxCredits,
            request.Multiplier,
            request.IsActive,
            request.EffectiveFrom), cancellationToken)));
    }

    [HttpDelete("{ruleId:guid}")]
    public async Task<ActionResult> Delete([FromRoute] Guid ruleId, CancellationToken cancellationToken)
    {
        var auth = await RequireAdminAsync(cancellationToken);
        if (auth is not null) return auth;

        await billingService.DeleteRuleAsync(ruleId, cancellationToken);
        return NoContent();
    }

    private static BillingRuleResponse Map(BillingRuleDto rule)
        => new(
            rule.Id,
            rule.ActionType,
            rule.Provider,
            rule.Model,
            rule.Version,
            rule.UnitType,
            rule.BaseFeeCredits,
            rule.RatePerUnitCredits,
            rule.MinCredits,
            rule.MaxCredits,
            rule.Multiplier,
            rule.IsActive,
            rule.EffectiveFrom,
            rule.CreatedAt,
            rule.UpdatedAt);
}
