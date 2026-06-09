using System.Buffers;
using System.Security.Cryptography;
using AiSummarizer.Application.Notes;
using Microsoft.Extensions.Options;

namespace AiSummarizer.Infrastructure.Storage;

public sealed class LocalNoteAssetStorage(IOptions<StorageOptions> options) : INoteAssetStorage
{
    public async Task<NoteAssetStorageResult> SaveAsync(NoteAssetStorageRequest request, Stream content, CancellationToken cancellationToken)
    {
        var root = StoragePathResolver.ResolveRoot(options.Value.RootPath, "data");
        var storageKey = BuildStorageKey(request.NoteId, request.AssetId, request.OriginalFilename, request.ContentType);
        var fullPath = ResolvePath(root, storageKey);

        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await using var file = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        using var hasher = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = ArrayPool<byte>.Shared.Rent(81920);
        try
        {
            long totalBytes = 0;
            while (true)
            {
                var read = await content.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
                if (read <= 0)
                {
                    break;
                }

                await file.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
                hasher.AppendData(buffer, 0, read);
                totalBytes += read;
            }

            await file.FlushAsync(cancellationToken);
            return new NoteAssetStorageResult(storageKey, totalBytes, Convert.ToHexString(hasher.GetHashAndReset()).ToLowerInvariant());
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    public Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        var root = StoragePathResolver.ResolveRoot(options.Value.RootPath, "data");
        var fullPath = ResolvePath(root, storageKey);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException("Stored note asset was not found.", fullPath);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
    {
        var root = StoragePathResolver.ResolveRoot(options.Value.RootPath, "data");
        var fullPath = ResolvePath(root, storageKey);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }

    private static string ResolvePath(string root, string storageKey)
    {
        var normalizedKey = storageKey.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(root, normalizedKey));
        var rootWithSeparator = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;
        if (!string.Equals(fullPath, root, StringComparison.OrdinalIgnoreCase) && !fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Storage key resolves outside of the storage root.");
        }

        return fullPath;
    }

    private static string BuildStorageKey(Guid noteId, Guid assetId, string originalFilename, string contentType)
    {
        var safeFilename = Path.GetFileName(originalFilename);
        var extension = Path.GetExtension(safeFilename);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ExtensionFromContentType(contentType);
        }

        return Path.Combine("notes", noteId.ToString("N"), $"{assetId:N}{extension}").Replace('\\', '/');
    }

    private static string ExtensionFromContentType(string contentType)
    {
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/jpg" => ".jpg",
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            "audio/mpeg" => ".mp3",
            "audio/mp3" => ".mp3",
            "audio/wav" => ".wav",
            "audio/x-wav" => ".wav",
            "application/pdf" => ".pdf",
            _ => ".bin",
        };
    }
}
