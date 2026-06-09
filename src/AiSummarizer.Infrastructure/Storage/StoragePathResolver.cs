namespace AiSummarizer.Infrastructure.Storage;

public static class StoragePathResolver
{
    public static string ResolveRoot(string? rootPath, string defaultFolderName)
    {
        var baseRoot = FindRepositoryRoot();
        var candidate = string.IsNullOrWhiteSpace(rootPath)
            ? Path.Combine(baseRoot, defaultFolderName)
            : rootPath.Trim();

        var fullPath = Path.IsPathRooted(candidate)
            ? Path.GetFullPath(candidate)
            : Path.GetFullPath(Path.Combine(baseRoot, candidate));

        Directory.CreateDirectory(fullPath);
        return fullPath;
    }

    private static string FindRepositoryRoot()
    {
        foreach (var start in EnumerateStartDirectories())
        {
            var current = new DirectoryInfo(start);
            while (current is not null)
            {
                if (File.Exists(Path.Combine(current.FullName, ".env")) || Directory.Exists(Path.Combine(current.FullName, ".git")))
                {
                    return current.FullName;
                }

                current = current.Parent;
            }
        }

        return Directory.GetCurrentDirectory();
    }

    private static IEnumerable<string> EnumerateStartDirectories()
    {
        yield return Directory.GetCurrentDirectory();
        yield return AppContext.BaseDirectory;
    }
}
