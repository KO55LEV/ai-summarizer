namespace AiSummarizer.Application.Billing;

public abstract class BillingException(string message) : Exception(message);

public sealed class BillingValidationException(string message) : BillingException(message);

public sealed class BillingNotFoundException(string message) : BillingException(message);

public sealed class BillingInsufficientFundsException(string message) : BillingException(message);

