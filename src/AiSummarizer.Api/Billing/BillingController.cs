using AiSummarizer.Application.Billing;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Billing;

[ApiController]
[Route("api/billing")]
public sealed class BillingController(IBillingService billingService) : ControllerBase
{
    [HttpGet("balance")]
    public async Task<ActionResult<BillingBalanceResponse>> GetBalance([FromQuery] Guid? requestedByUserId = null, CancellationToken cancellationToken = default)
    {
        if (requestedByUserId is null || requestedByUserId == Guid.Empty)
        {
            return BadRequest(new
            {
                status = StatusCodes.Status400BadRequest,
                detail = "requestedByUserId is required."
            });
        }

        return Ok(Map(await billingService.GetBalanceAsync(requestedByUserId.Value, cancellationToken)));
    }

    [HttpGet("ledger")]
    public async Task<ActionResult<IReadOnlyList<BillingLedgerEntryResponse>>> GetLedger(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] int limit = 100,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        if (requestedByUserId is null || requestedByUserId == Guid.Empty)
        {
            return BadRequest(new
            {
                status = StatusCodes.Status400BadRequest,
                detail = "requestedByUserId is required."
            });
        }

        return Ok((await billingService.ListLedgerAsync(requestedByUserId.Value, limit, offset, cancellationToken)).Select(Map).ToArray());
    }

    [HttpGet("reservations")]
    public async Task<ActionResult<IReadOnlyList<BillingReservationResponse>>> GetReservations(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] int limit = 100,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
    {
        if (requestedByUserId is null || requestedByUserId == Guid.Empty)
        {
            return BadRequest(new
            {
                status = StatusCodes.Status400BadRequest,
                detail = "requestedByUserId is required."
            });
        }

        return Ok((await billingService.ListReservationsAsync(requestedByUserId.Value, limit, offset, cancellationToken)).Select(Map).ToArray());
    }

    [HttpPost("reserve")]
    public async Task<ActionResult<BillingReservationResponse>> Reserve([FromBody] ReserveBillingCreditsRequest request, CancellationToken cancellationToken)
        => Ok(Map(await billingService.ReserveAsync(new ReserveBillingCreditsCommand(
            request.RequestedByUserId,
            request.SourceType,
            request.SourceId,
            request.EstimatedCredits,
            request.Reason), cancellationToken)));

    [HttpPost("settle")]
    public async Task<ActionResult<BillingReservationResponse>> Settle([FromBody] SettleBillingReservationRequest request, CancellationToken cancellationToken)
        => Ok(Map(await billingService.SettleAsync(new SettleBillingReservationCommand(
            request.ReservationId,
            request.FinalCredits,
            request.Reason), cancellationToken)));

    [HttpPost("release")]
    public async Task<ActionResult<BillingReservationResponse>> Release([FromBody] ReleaseBillingReservationRequest request, CancellationToken cancellationToken)
        => Ok(Map(await billingService.ReleaseAsync(new ReleaseBillingReservationCommand(
            request.ReservationId,
            request.Reason), cancellationToken)));

    [HttpPost("topup")]
    public async Task<ActionResult<BillingBalanceResponse>> TopUp([FromBody] TopUpBillingCreditsRequest request, CancellationToken cancellationToken)
        => Ok(Map(await billingService.TopUpAsync(new TopUpBillingCreditsCommand(
            request.RequestedByUserId,
            request.Credits,
            request.Reason), cancellationToken)));

    private static BillingBalanceResponse Map(BillingBalanceDto balance)
        => new(
            balance.Account.UserId,
            balance.Account.BalanceCredits,
            balance.Account.ReservedCredits,
            balance.Account.AvailableCredits,
            balance.Account.CreatedAt,
            balance.Account.UpdatedAt);

    private static BillingReservationResponse Map(BillingReservationDto reservation)
        => new(
            reservation.Id,
            reservation.UserId,
            reservation.SourceType,
            reservation.SourceId,
            reservation.EstimatedCredits,
            reservation.FinalCredits,
            reservation.Status,
            reservation.Reason,
            reservation.SettledAt,
            reservation.ReleasedAt,
            reservation.ExpiresAt,
            reservation.CreatedAt,
            reservation.UpdatedAt);

    private static BillingLedgerEntryResponse Map(BillingLedgerEntryDto entry)
        => new(
            entry.Id,
            entry.UserId,
            entry.ReservationId,
            entry.EntryType,
            entry.AmountCredits,
            entry.BalanceDeltaCredits,
            entry.ReservedDeltaCredits,
            entry.BalanceBeforeCredits,
            entry.BalanceAfterCredits,
            entry.ReservedBeforeCredits,
            entry.ReservedAfterCredits,
            entry.SourceType,
            entry.SourceId,
            entry.Reason,
            entry.CreatedAt);
}
