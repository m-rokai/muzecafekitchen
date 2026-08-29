import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  backupDatabase,
  checkDatabaseIntegrity,
  getDatabasePath,
} from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../backups');
const BACKUP_FILENAME_PATTERN = /^muze_backup_[0-9TZ-]+\.db$/;

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function assertIntegrity(databasePath) {
  const candidate = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const result = candidate.prepare('PRAGMA integrity_check').get();
    if (result?.integrity_check !== 'ok') {
      throw new Error(`SQLite integrity check failed for ${databasePath}`);
    }
  } finally {
    candidate.close();
  }
}

function validateBackupFilename(filename) {
  if (!filename || path.basename(filename) !== filename || !BACKUP_FILENAME_PATTERN.test(filename)) {
    throw new Error('Invalid backup filename');
  }
}

/**
 * Create a backup of the database
 * @returns {Object} Result with success status and backup path
 */
export async function createBackup() {
  try {
    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `muze_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    const databasePath = getDatabasePath();
    // SQLite's online backup API is safe while the live connection is open.
    if (databasePath !== ':memory:' && !fs.existsSync(databasePath)) {
      throw new Error('Database file not found');
    }

    if (checkDatabaseIntegrity() !== 'ok') {
      throw new Error('SQLite integrity check failed for live database');
    }
    await backupDatabase(backupPath);
    assertIntegrity(backupPath);

    // Get file size for info
    const stats = fs.statSync(backupPath);
    const sizeKB = Math.round(stats.size / 1024);

    return {
      success: true,
      filename: backupFilename,
      path: backupPath,
      size: `${sizeKB} KB`,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Backup creation failed:', err);
    throw err;
  }
}

/**
 * List all available backups
 * @returns {Array} List of backup objects with metadata
 */
export function listBackups() {
  try {
    ensureBackupDir();

    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith('muze_backup_') && f.endsWith('.db'))
      .map(filename => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: `${Math.round(stats.size / 1024)} KB`,
          created: stats.mtime.toISOString(),
          timestamp: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp) // Newest first
      .slice(0, 20); // Keep only last 20 in list

    return backups;
  } catch (err) {
    console.error('Failed to list backups:', err);
    return [];
  }
}

/**
 * Restore database from a backup file
 * @param {string} filename - Name of the backup file to restore
 * @returns {Object} Result with success status
 */
export async function restoreBackup(filename) {
  try {
    validateBackupFilename(filename);

    const backupPath = path.join(BACKUP_DIR, filename);

    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    assertIntegrity(backupPath);

    const databasePath = getDatabasePath();
    if (databasePath === ':memory:') {
      throw new Error('Restoring an in-memory database is not supported');
    }

    // Preserve a verified pre-restore snapshot before changing the live DB.
    const preRestore = await createBackup();

    const source = new Database(backupPath, { readonly: true, fileMustExist: true });
    try {
      await source.backup(databasePath);
    } finally {
      source.close();
    }
    if (checkDatabaseIntegrity() !== 'ok') {
      throw new Error('SQLite integrity check failed after restore');
    }

    return {
      success: true,
      restored: filename,
      preRestoreBackup: preRestore.filename,
      message: 'Database restored successfully. Server restart may be required.',
    };
  } catch (err) {
    console.error('Restore failed:', err);
    throw err;
  }
}

/**
 * Delete a specific backup file
 * @param {string} filename - Name of the backup file to delete
 * @returns {Object} Result with success status
 */
export function deleteBackup(filename) {
  try {
    // Validate filename to prevent path traversal
    validateBackupFilename(filename);

    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    // Handle TOCTOU race condition - file could be deleted between check and unlink
    try {
      fs.unlinkSync(backupPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('Backup file not found');
      }
      throw err;
    }

    return { success: true, deleted: filename };
  } catch (err) {
    console.error('Delete backup failed:', err);
    throw err;
  }
}

/**
 * Delete backups older than specified days
 * @param {number} days - Number of days to keep backups (default: 7)
 * @returns {Object} Result with count of deleted backups
 */
export function deleteOldBackups(days = 7) {
  try {
    ensureBackupDir();

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;

    for (const file of files) {
      // Don't delete pre-restore backups automatically
      if (!file.startsWith('muze_backup_') || !file.endsWith('.db')) {
        continue;
      }

      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} backup(s) older than ${days} days`,
    };
  } catch (err) {
    console.error('Cleanup failed:', err);
    throw err;
  }
}

/**
 * Get backup storage info
 * @returns {Object} Storage usage information
 */
export function getBackupInfo() {
  try {
    ensureBackupDir();

    const files = fs.readdirSync(BACKUP_DIR);
    let totalSize = 0;
    let backupCount = 0;

    for (const file of files) {
      if (file.endsWith('.db')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        backupCount++;
      }
    }

    return {
      backupCount,
      totalSize: `${Math.round(totalSize / 1024)} KB`,
      backupDir: BACKUP_DIR,
    };
  } catch (err) {
    console.error('Failed to get backup info:', err);
    return { backupCount: 0, totalSize: '0 KB' };
  }
}
