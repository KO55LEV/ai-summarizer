using System.Text;
using System.Text.RegularExpressions;

namespace AiSummarizer.Shared;

public static class EnvironmentBootstrapper
{
    private static readonly Regex PlaceholderRegex = new(@"\$\{(?<name>[A-Za-z_][A-Za-z0-9_]*)\}", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static int _loaded;

    public static void Load()
    {
        if (Interlocked.Exchange(ref _loaded, 1) == 1)
        {
            return;
        }

        var envFilePath = FindEnvFile();
        if (envFilePath is null)
        {
            return;
        }

        var parsedValues = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var line in File.ReadLines(envFilePath, Encoding.UTF8))
        {
            if (!TryParseLine(line, out var key, out var value))
            {
                continue;
            }

            parsedValues[key] = value;
        }

        foreach (var (key, rawValue) in parsedValues)
        {
            var currentValue = Environment.GetEnvironmentVariable(key);
            if (currentValue is not null && !currentValue.Contains("${", StringComparison.Ordinal))
            {
                continue;
            }

            Environment.SetEnvironmentVariable(key, ExpandValue(rawValue, parsedValues));
        }
    }

    private static string? FindEnvFile()
    {
        foreach (var directory in EnumerateSearchDirectories())
        {
            var candidate = Path.Combine(directory, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static IEnumerable<string> EnumerateSearchDirectories()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var start in GetStartDirectories())
        {
            var current = new DirectoryInfo(start);
            while (current is not null)
            {
                if (seen.Add(current.FullName))
                {
                    yield return current.FullName;
                }

                current = current.Parent;
            }
        }
    }

    private static IEnumerable<string> GetStartDirectories()
    {
        yield return Directory.GetCurrentDirectory();
        yield return AppContext.BaseDirectory;
    }

    private static bool TryParseLine(string line, out string key, out string value)
    {
        key = string.Empty;
        value = string.Empty;

        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#'))
        {
            return false;
        }

        if (trimmed.StartsWith("export ", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed["export ".Length..].TrimStart();
        }

        var separatorIndex = trimmed.IndexOf('=');
        if (separatorIndex <= 0)
        {
            return false;
        }

        key = trimmed[..separatorIndex].Trim();
        value = trimmed[(separatorIndex + 1)..].Trim();

        if (key.Length == 0)
        {
            return false;
        }

        if ((value.StartsWith('"') && value.EndsWith('"')) || (value.StartsWith('\'') && value.EndsWith('\'')))
        {
            value = value[1..^1];
        }

        return true;
    }

    private static string ExpandValue(string rawValue, IReadOnlyDictionary<string, string> localValues)
    {
        var value = rawValue;

        for (var i = 0; i < 8; i++)
        {
            var next = PlaceholderRegex.Replace(value, match =>
            {
                var name = match.Groups["name"].Value;
                return Environment.GetEnvironmentVariable(name)
                    ?? (localValues.TryGetValue(name, out var localValue) ? localValue : match.Value);
            });

            if (string.Equals(next, value, StringComparison.Ordinal))
            {
                break;
            }

            value = next;
        }

        return value;
    }
}
