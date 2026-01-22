import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../backups');
const DB_PATH = path.join(__dirname, '../db/muze_orders.db');

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Create a backup of the database
 * @returns {Object} Result with success status and backup path
 */
export function createBackup() {
  try {
    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `muze_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Check if source database exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Database file not found');
    }

    // Copy database file
    fs.copyFileSync(DB_PATH, backupPath);

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
export function restoreBackup(filename) {
  try {
    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid backup filename');
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    // Check if backup exists
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    // Create a backup of current database before restoring
    const preRestoreBackup = `muze_pre_restore_${Date.now()}.db`;
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, preRestoreBackup));
    }

    // Restore the backup
    fs.copyFileSync(backupPath, DB_PATH);

    return {
      success: true,
      restored: filename,
      preRestoreBackup,
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
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid backup filename');
    }

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
