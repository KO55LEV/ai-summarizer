using System.Data.Common;
using AiSummarizer.Domain.Notes;

namespace AiSummarizer.Application.Notes;

public interface INotesRepository
{
    Task<T> ExecuteInTransactionAsync<T>(Func<INotesRepository, DbTransaction, Task<T>> action, CancellationToken cancellationToken);
    Task<Note?> GetNoteByIdAsync(Guid noteId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Note>> ListNotesAsync(Guid? requestedByUserId, Guid? projectId, int limit, int offset, CancellationToken cancellationToken);
    Task<Note> CreateNoteAsync(Note note, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<Note> UpdateNoteAsync(Note note, DbTransaction? transaction, CancellationToken cancellationToken);
    Task DeleteNoteAsync(Guid noteId, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<NoteAsset?> GetNoteAssetByIdAsync(Guid noteAssetId, CancellationToken cancellationToken);
    Task<NoteInput?> GetNoteInputByIdAsync(Guid noteInputId, CancellationToken cancellationToken);
    Task<NoteInput?> GetNoteInputByExternalIdentityAsync(string sourceChannel, string externalSourceId, string externalMessageId, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteInput>> ListNoteInputsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<NoteInput> CreateNoteInputAsync(NoteInput noteInput, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<NoteInput> UpdateNoteInputAsync(NoteInput noteInput, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<NoteAsset> CreateNoteAssetAsync(NoteAsset noteAsset, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteAsset>> ListNoteAssetsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<NoteTextVersion> CreateNoteTextVersionAsync(NoteTextVersion noteTextVersion, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteTextVersion>> ListNoteTextVersionsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<NoteProcessingRun> CreateNoteProcessingRunAsync(NoteProcessingRun noteProcessingRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<NoteProcessingRun?> GetNoteProcessingRunByIdAsync(Guid noteProcessingRunId, CancellationToken cancellationToken);
    Task<NoteProcessingRun> UpdateNoteProcessingRunAsync(NoteProcessingRun noteProcessingRun, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteProcessingRun>> ListNoteProcessingRunsAsync(Guid noteId, int limit, int offset, CancellationToken cancellationToken);
    Task<TelegramAccount?> GetTelegramAccountByIdAsync(Guid telegramAccountId, CancellationToken cancellationToken);
    Task<TelegramAccount?> GetTelegramAccountByTelegramUserIdAsync(long telegramUserId, CancellationToken cancellationToken);
    Task<TelegramAccount> UpsertTelegramAccountAsync(TelegramAccount telegramAccount, DbTransaction? transaction, CancellationToken cancellationToken);
    Task<UserTelegramAccount?> GetUserTelegramAccountByUserIdAsync(Guid userId, CancellationToken cancellationToken);
    Task<UserTelegramAccount?> GetUserTelegramAccountByTelegramAccountIdAsync(Guid telegramAccountId, CancellationToken cancellationToken);
    Task<UserTelegramAccount> LinkUserTelegramAccountAsync(UserTelegramAccount link, DbTransaction? transaction, CancellationToken cancellationToken);
    Task RevokeUserTelegramAccountAsync(Guid userTelegramAccountId, DateTimeOffset revokedAt, DbTransaction? transaction, CancellationToken cancellationToken);
}

public interface INoteAssetStorage
{
    Task<NoteAssetStorageResult> SaveAsync(NoteAssetStorageRequest request, Stream content, CancellationToken cancellationToken);
    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken);
    Task DeleteAsync(string storageKey, CancellationToken cancellationToken);
}

public interface INotesService
{
    Task<NotesListDto> ListNotesAsync(Guid? requestedByUserId, Guid? projectId, int limit, int offset, CancellationToken cancellationToken);
    Task<NoteDetailDto> GetNoteAsync(Guid noteId, CancellationToken cancellationToken);
    Task<NoteDetailDto> CreateNoteAsync(CreateNoteCommand command, CancellationToken cancellationToken);
    Task<NoteDetailDto> UpdateNoteAsync(Guid noteId, UpdateNoteCommand command, CancellationToken cancellationToken);
    Task DeleteNoteAsync(Guid noteId, CancellationToken cancellationToken);
    Task<NoteInputDto> AddNoteInputAsync(CreateNoteInputCommand command, CancellationToken cancellationToken);
    Task<NoteAssetDto> AddNoteAssetAsync(CreateNoteAssetCommand command, CancellationToken cancellationToken);
    Task<NoteAssetDto> UploadNoteAssetAsync(UploadNoteAssetCommand command, CancellationToken cancellationToken);
    Task<NoteTextVersionDto> AddNoteTextVersionAsync(CreateNoteTextVersionCommand command, CancellationToken cancellationToken);
    Task<NoteProcessingRunDto> AddNoteProcessingRunAsync(CreateNoteProcessingRunCommand command, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteInputDto>> ListNoteInputsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteAssetDto>> ListNoteAssetsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteTextVersionDto>> ListNoteTextVersionsAsync(Guid noteId, CancellationToken cancellationToken);
    Task<IReadOnlyList<NoteProcessingRunDto>> ListNoteProcessingRunsAsync(Guid noteId, int limit, int offset, CancellationToken cancellationToken);
    Task<TelegramAccountDto> UpsertTelegramAccountAsync(LinkTelegramAccountCommand command, CancellationToken cancellationToken);
    Task<UserTelegramAccountDto> LinkTelegramAccountAsync(Guid requestedByUserId, Guid telegramAccountId, CancellationToken cancellationToken);
    Task RevokeTelegramAccountLinkAsync(Guid userTelegramAccountId, CancellationToken cancellationToken);
    Task<TelegramAccountDto?> GetTelegramAccountByTelegramUserIdAsync(long telegramUserId, CancellationToken cancellationToken);
    Task<TelegramAccountDto?> GetTelegramAccountByIdAsync(Guid telegramAccountId, CancellationToken cancellationToken);
    Task<UserTelegramAccountDto?> GetLinkedTelegramAccountAsync(Guid userId, CancellationToken cancellationToken);
}
