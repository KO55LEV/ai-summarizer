namespace AiSummarizer.Application.Billing;

public static class BillingUsageEstimator
{
    public static decimal EstimateWorkflowCredits(string workflowType)
        => workflowType.Trim().ToLowerInvariant() switch
        {
            "youtube.transcript" => 15m,
            "youtube.summary" => 15m,
            _ => 10m
        };
}
