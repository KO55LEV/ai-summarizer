using AiSummarizer.Application.Users;
using AiSummarizer.Application.Jobs;

namespace AiSummarizer.Api.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (UserConflictException ex)
        {
            await WriteProblem(context, StatusCodes.Status409Conflict, ex.Message);
        }
        catch (UserUnauthorizedException ex)
        {
            await WriteProblem(context, StatusCodes.Status401Unauthorized, ex.Message);
        }
        catch (UserNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, ex.Message);
        }
        catch (JobNotFoundException ex)
        {
            await WriteProblem(context, StatusCodes.Status404NotFound, ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            await WriteProblem(context, StatusCodes.Status401Unauthorized, ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            await WriteProblem(context, StatusCodes.Status500InternalServerError, "An unexpected error occurred.");
        }
    }

    private static async Task WriteProblem(HttpContext context, int statusCode, string detail)
    {
        if (context.Response.HasStarted)
        {
            throw new InvalidOperationException("The response has already started.");
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = statusCode,
            detail
        });
    }
}
