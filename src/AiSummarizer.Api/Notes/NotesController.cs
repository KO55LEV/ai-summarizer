using AiSummarizer.Application.Notes;
using Microsoft.AspNetCore.Mvc;

namespace AiSummarizer.Api.Notes;

[ApiController]
[Route("api/notes")]
public sealed class NotesController(INotesService notesService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<NoteListResponse>> GetList(
        [FromQuery] Guid? requestedByUserId = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => Ok(Map(await notesService.ListNotesAsync(requestedByUserId, projectId, limit, offset, cancellationToken)));

    [HttpGet("{noteId:guid}")]
    public async Task<ActionResult<NoteDetailResponse>> GetNote([FromRoute] Guid noteId, CancellationToken cancellationToken)
        => Ok(Map(await notesService.GetNoteAsync(noteId, cancellationToken)));

    [HttpPost]
    public async Task<ActionResult<NoteDetailResponse>> CreateNote([FromBody] CreateNoteRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.CreateNoteAsync(new CreateNoteCommand(
            request.RequestedByUserId,
            request.ProjectId,
            request.Title,
            request.SourceChannel,
            request.InputKind,
            request.PrimaryLanguage,
            request.Summary), cancellationToken)));

    [HttpPut("{noteId:guid}")]
    public async Task<ActionResult<NoteDetailResponse>> UpdateNote([FromRoute] Guid noteId, [FromBody] UpdateNoteRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.UpdateNoteAsync(noteId, new UpdateNoteCommand(
            request.Title,
            request.Status,
            request.ProjectId,
            request.PrimaryLanguage,
            request.Summary), cancellationToken)));

    [HttpDelete("{noteId:guid}")]
    public async Task<IActionResult> DeleteNote([FromRoute] Guid noteId, CancellationToken cancellationToken)
    {
        await notesService.DeleteNoteAsync(noteId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{noteId:guid}/inputs")]
    public async Task<ActionResult<IReadOnlyList<NoteInputResponse>>> ListInputs([FromRoute] Guid noteId, CancellationToken cancellationToken)
        => Ok((await notesService.ListNoteInputsAsync(noteId, cancellationToken)).Select(Map).ToArray());

    [HttpPost("{noteId:guid}/inputs")]
    public async Task<ActionResult<NoteInputResponse>> AddInput([FromRoute] Guid noteId, [FromBody] CreateNoteInputRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.AddNoteInputAsync(new CreateNoteInputCommand(
            noteId,
            request.SourceChannel,
            request.ExternalSourceId,
            request.ExternalMessageId,
            request.InputKind,
            request.RawText,
            request.RawPayload,
            request.Status,
            request.ReceivedAt,
            request.ProcessedAt), cancellationToken)));

    [HttpGet("{noteId:guid}/assets")]
    public async Task<ActionResult<IReadOnlyList<NoteAssetResponse>>> ListAssets([FromRoute] Guid noteId, CancellationToken cancellationToken)
        => Ok((await notesService.ListNoteAssetsAsync(noteId, cancellationToken)).Select(Map).ToArray());

    [HttpPost("{noteId:guid}/assets")]
    public async Task<ActionResult<NoteAssetResponse>> AddAsset([FromRoute] Guid noteId, [FromBody] CreateNoteAssetRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.AddNoteAssetAsync(new CreateNoteAssetCommand(
            noteId,
            request.NoteInputId,
            request.AssetType,
            request.MimeType,
            request.StorageKey,
            request.OriginalFilename,
            request.SizeBytes,
            request.ChecksumSha256,
            request.DurationSeconds,
            request.Width,
            request.Height,
            request.Metadata), cancellationToken)));

    [HttpPost("{noteId:guid}/assets/upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<NoteAssetResponse>> UploadAsset(
        [FromRoute] Guid noteId,
        [FromForm] IFormFile file,
        [FromForm] Guid? noteInputId,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { detail = "File is required." });
        }

        await using var stream = file.OpenReadStream();
        return Ok(Map(await notesService.UploadNoteAssetAsync(new UploadNoteAssetCommand(
            noteId,
            noteInputId,
            file.FileName,
            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            stream), cancellationToken)));
    }

    [HttpGet("{noteId:guid}/text-versions")]
    public async Task<ActionResult<IReadOnlyList<NoteTextVersionResponse>>> ListTextVersions([FromRoute] Guid noteId, CancellationToken cancellationToken)
        => Ok((await notesService.ListNoteTextVersionsAsync(noteId, cancellationToken)).Select(Map).ToArray());

    [HttpPost("{noteId:guid}/text-versions")]
    public async Task<ActionResult<NoteTextVersionResponse>> AddTextVersion([FromRoute] Guid noteId, [FromBody] CreateNoteTextVersionRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.AddNoteTextVersionAsync(new CreateNoteTextVersionCommand(
            noteId,
            request.SourceAssetId,
            request.SourceRunId,
            request.VersionKind,
            request.Text,
            request.Language,
            request.Provider,
            request.Model,
            request.PromptVersion), cancellationToken)));

    [HttpGet("{noteId:guid}/processing-runs")]
    public async Task<ActionResult<IReadOnlyList<NoteProcessingRunResponse>>> ListProcessingRuns(
        [FromRoute] Guid noteId,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken cancellationToken = default)
        => Ok((await notesService.ListNoteProcessingRunsAsync(noteId, limit, offset, cancellationToken)).Select(Map).ToArray());

    [HttpPost("{noteId:guid}/processing-runs")]
    public async Task<ActionResult<NoteProcessingRunResponse>> AddProcessingRun([FromRoute] Guid noteId, [FromBody] CreateNoteProcessingRunRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.AddNoteProcessingRunAsync(new CreateNoteProcessingRunCommand(
            noteId,
            request.JobId,
            request.SourceAssetId,
            request.Stage,
            request.Status,
            request.Provider,
            request.Model,
            request.PromptVersion,
            request.InputHash,
            request.Request,
            request.Response,
            request.Output,
            request.Usage,
            request.Metrics,
            request.ErrorCode,
            request.ErrorMessage,
            request.StartedAt,
            request.FinishedAt), cancellationToken)));

    [HttpGet("telegram/{telegramUserId:long}")]
    public async Task<ActionResult<TelegramAccountResponse>> GetTelegramAccount([FromRoute] long telegramUserId, CancellationToken cancellationToken)
    {
        var account = await notesService.GetTelegramAccountByTelegramUserIdAsync(telegramUserId, cancellationToken);
        return account is null ? NotFound() : Ok(Map(account));
    }

    [HttpGet("telegram/linked/{requestedByUserId:guid}")]
    public async Task<ActionResult<LinkedTelegramAccountResponse>> GetLinkedTelegramAccount([FromRoute] Guid requestedByUserId, CancellationToken cancellationToken)
    {
        var link = await notesService.GetLinkedTelegramAccountAsync(requestedByUserId, cancellationToken);
        if (link is null)
        {
            return NotFound();
        }

        var account = await notesService.GetTelegramAccountByIdAsync(link.TelegramAccountId, cancellationToken);
        return account is null ? NotFound() : Ok(new LinkedTelegramAccountResponse(Map(link), Map(account)));
    }

    [HttpPost("telegram/accounts")]
    public async Task<ActionResult<TelegramAccountResponse>> UpsertTelegramAccount([FromBody] LinkTelegramAccountRequest request, CancellationToken cancellationToken)
        => Ok(Map(await notesService.UpsertTelegramAccountAsync(new LinkTelegramAccountCommand(
            request.RequestedByUserId,
            request.TelegramUserId,
            request.Username,
            request.FirstName,
            request.LastName,
            request.DisplayName,
            request.LanguageCode,
            request.IsBot), cancellationToken)));

    [HttpPost("telegram/link")]
    public async Task<ActionResult<UserTelegramAccountResponse>> LinkTelegramAccount([FromBody] LinkTelegramAccountRequest request, CancellationToken cancellationToken)
    {
        var account = await notesService.UpsertTelegramAccountAsync(new LinkTelegramAccountCommand(
            request.RequestedByUserId,
            request.TelegramUserId,
            request.Username,
            request.FirstName,
            request.LastName,
            request.DisplayName,
            request.LanguageCode,
            request.IsBot), cancellationToken);

        return Ok(Map(await notesService.LinkTelegramAccountAsync(request.RequestedByUserId, account.Id, cancellationToken)));
    }

    [HttpDelete("telegram/links/{userTelegramAccountId:guid}")]
    public async Task<IActionResult> RevokeTelegramAccountLink([FromRoute] Guid userTelegramAccountId, CancellationToken cancellationToken)
    {
        await notesService.RevokeTelegramAccountLinkAsync(userTelegramAccountId, cancellationToken);
        return NoContent();
    }

    private static NoteListResponse Map(NotesListDto list)
        => new(list.Notes.Select(Map).ToArray());

    private static NoteDetailResponse Map(NoteDetailDto detail)
        => new(
            Map(detail.Note),
            detail.Inputs.Select(Map).ToArray(),
            detail.Assets.Select(Map).ToArray(),
            detail.TextVersions.Select(Map).ToArray(),
            detail.ProcessingRuns.Select(Map).ToArray());

    private static NoteResponse Map(NoteDto note)
        => new(
            note.Id,
            note.RequestedByUserId,
            note.ProjectId,
            note.ProjectName,
            note.Title,
            note.Status,
            note.SourceChannel,
            note.InputKind,
            note.PrimaryLanguage,
            note.CurrentTextVersionId,
            note.Summary,
            note.CreatedAt,
            note.UpdatedAt);

    private static NoteInputResponse Map(NoteInputDto input)
        => new(
            input.Id,
            input.NoteId,
            input.SourceChannel,
            input.ExternalSourceId,
            input.ExternalMessageId,
            input.InputKind,
            input.RawText,
            input.RawPayload,
            input.Status,
            input.ReceivedAt,
            input.ProcessedAt,
            input.CreatedAt,
            input.UpdatedAt);

    private static NoteAssetResponse Map(NoteAssetDto asset)
        => new(
            asset.Id,
            asset.NoteId,
            asset.NoteInputId,
            asset.AssetType,
            asset.MimeType,
            asset.StorageKey,
            asset.OriginalFilename,
            asset.SizeBytes,
            asset.ChecksumSha256,
            asset.DurationSeconds,
            asset.Width,
            asset.Height,
            asset.Metadata,
            asset.CreatedAt,
            asset.UpdatedAt);

    private static NoteTextVersionResponse Map(NoteTextVersionDto version)
        => new(
            version.Id,
            version.NoteId,
            version.SourceAssetId,
            version.SourceRunId,
            version.VersionKind,
            version.Text,
            version.Language,
            version.Provider,
            version.Model,
            version.PromptVersion,
            version.CreatedAt);

    private static NoteProcessingRunResponse Map(NoteProcessingRunDto run)
        => new(
            run.Id,
            run.NoteId,
            run.JobId,
            run.SourceAssetId,
            run.Stage,
            run.Status,
            run.Provider,
            run.Model,
            run.PromptVersion,
            run.InputHash,
            run.Request,
            run.Response,
            run.Output,
            run.Usage,
            run.Metrics,
            run.ErrorCode,
            run.ErrorMessage,
            run.StartedAt,
            run.FinishedAt,
            run.CreatedAt,
            run.UpdatedAt);

    private static TelegramAccountResponse Map(TelegramAccountDto account)
        => new(
            account.Id,
            account.TelegramUserId,
            account.Username,
            account.FirstName,
            account.LastName,
            account.DisplayName,
            account.LanguageCode,
            account.IsBot,
            account.LastSeenAt,
            account.Metadata,
            account.CreatedAt,
            account.UpdatedAt);

    private static UserTelegramAccountResponse Map(UserTelegramAccountDto account)
        => new(
            account.Id,
            account.RequestedByUserId,
            account.TelegramAccountId,
            account.LinkedAt,
            account.RevokedAt,
            account.CreatedAt,
            account.UpdatedAt);
}
