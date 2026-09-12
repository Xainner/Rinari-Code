//! One-time desktop profile migration. Engine-owned ~/.rinari is never touched.
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const OLD_ID: &str = "com.rinari.code";
const NEW_ID: &str = "com.rinari.agent";

/// Copy into a staging directory, then publish it. Never merge or replace a profile.
pub fn migrate_profile(base: &Path) -> io::Result<bool> {
    let source = base.join(OLD_ID);
    let destination = base.join(NEW_ID);
    if destination.try_exists()? || !source.try_exists()? {
        return Ok(false);
    }
    reject_link(&source)?;
    let staging = base.join(format!("{NEW_ID}.migration-{}", std::process::id()));
    // create_dir deliberately refuses stale staging directories; no recursive cleanup.
    fs::create_dir(&staging)?;
    copy_directory(&source, &staging)?;
    fs::write(
        staging.join(".rinari-identity-migration"),
        "from=com.rinari.code\nversion=1\n",
    )?;
    if destination.try_exists()? {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "A new profile appeared during migration",
        ));
    }
    fs::rename(staging, destination)?;
    Ok(true)
}

fn reject_link(path: &Path) -> io::Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    let linked = metadata.file_type().is_symlink();
    #[cfg(windows)]
    let linked = {
        use std::os::windows::fs::MetadataExt;
        linked || metadata.file_attributes() & 0x400 != 0 // junctions/reparse points
    };
    if linked {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Linked profile entries require manual migration",
        ));
    }
    Ok(())
}

fn copy_directory(source: &Path, destination: &Path) -> io::Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        reject_link(&entry.path())?;
        let target = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            fs::create_dir(&target)?;
            copy_directory(&entry.path(), &target)?;
        } else if entry.file_type()?.is_file() {
            fs::copy(entry.path(), target)?;
        } else {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Unsupported profile entry",
            ));
        }
    }
    Ok(())
}

fn profile_bases() -> Vec<PathBuf> {
    #[cfg(windows)]
    let paths: Vec<PathBuf> = ["LOCALAPPDATA", "APPDATA"]
        .iter()
        .filter_map(std::env::var_os)
        .map(PathBuf::from)
        .collect();
    #[cfg(target_os = "macos")]
    let paths: Vec<PathBuf> = std::env::var_os("HOME")
        .into_iter()
        .map(|home| PathBuf::from(home).join("Library/Application Support"))
        .collect();
    #[cfg(not(any(windows, target_os = "macos")))]
    let paths: Vec<PathBuf> = [
        ("XDG_DATA_HOME", ".local/share"),
        ("XDG_CONFIG_HOME", ".config"),
    ]
    .iter()
    .filter_map(|(variable, fallback)| {
        std::env::var_os(variable)
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(fallback)))
    })
    .collect();
    let mut unique = Vec::new();
    for path in paths {
        if path.is_absolute() && !unique.contains(&path) {
            unique.push(path);
        }
    }
    unique
}

/// Run before Tauri creates a WebView or starts logging in the destination profile.
pub fn migrate_legacy_profiles() -> io::Result<()> {
    let bases = profile_bases();
    #[cfg(windows)]
    if bases
        .iter()
        .any(|base| base.join(OLD_ID).exists() && !base.join(NEW_ID).exists())
    {
        use std::os::windows::process::CommandExt;
        let processes = std::process::Command::new("tasklist.exe")
            .args(["/FI", "IMAGENAME eq rinari-code.exe", "/FO", "CSV", "/NH"])
            .args(["/FI", &format!("PID ne {}", std::process::id())])
            .creation_flags(0x08000000)
            .output()?;
        if !processes.status.success()
            || String::from_utf8_lossy(&processes.stdout)
                .to_lowercase()
                .contains("rinari-code.exe")
        {
            return Err(io::Error::other(
                "Close Rinari Code before starting Rinari Agent for the first time",
            ));
        }
    }
    for base in bases {
        migrate_profile(&base)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    fn fixture() -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "rinari-identity-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        path
    }
    #[test]
    fn preserves_original_and_is_idempotent() {
        let base = fixture();
        fs::create_dir_all(base.join(OLD_ID).join("EBWebView")).unwrap();
        fs::write(base.join(OLD_ID).join("EBWebView/preferences"), "draft").unwrap();
        assert!(migrate_profile(&base).unwrap());
        assert!(!migrate_profile(&base).unwrap());
        assert_eq!(
            fs::read(base.join(NEW_ID).join("EBWebView/preferences")).unwrap(),
            b"draft"
        );
        assert!(base.join(OLD_ID).join("EBWebView/preferences").exists());
        fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn does_not_merge_existing_new_profile() {
        let base = fixture();
        fs::create_dir(base.join(OLD_ID)).unwrap();
        fs::create_dir(base.join(NEW_ID)).unwrap();
        fs::write(base.join(NEW_ID).join("preferences"), "new").unwrap();
        assert!(!migrate_profile(&base).unwrap());
        assert_eq!(
            fs::read(base.join(NEW_ID).join("preferences")).unwrap(),
            b"new"
        );
        fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn clean_install_does_not_create_profile() {
        let base = fixture();
        assert!(!migrate_profile(&base).unwrap());
        assert!(!base.join(NEW_ID).exists());
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn interrupted_staging_is_not_published_or_overwritten() {
        let base = fixture();
        fs::create_dir(base.join(OLD_ID)).unwrap();
        let staging = base.join(format!("{NEW_ID}.migration-{}", std::process::id()));
        fs::create_dir(&staging).unwrap();
        fs::write(staging.join("partial"), "keep").unwrap();
        assert!(migrate_profile(&base).is_err());
        assert!(!base.join(NEW_ID).exists());
        assert_eq!(fs::read(staging.join("partial")).unwrap(), b"keep");
        fs::remove_dir_all(base).unwrap();
    }
}
