namespace AiSummarizer.Application.Billing;

public static class BillingUsageEstimator
{
    public static decimal EstimateWorkflowCredits(string workflowType)
        => workflowType.Trim().ToLowerInvariant() switch
        {
            "youtube.transcript" => 15m,
            "youtube.summary" => 15m,
            "youtube.summary.quick_summary" => 10m,
            "youtube.summary.key_takeaways" => 10m,
            "youtube.summary.ask_this_video" => 10m,
            "youtube.summary.study_guide" => 10m,
            _ => 10m
        };
}
