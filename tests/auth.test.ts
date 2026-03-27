// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import { isCommandSafe } from '../src/bot/middleware/auth';

describe('Auth Middleware', () => {
  describe('isCommandSafe', () => {
    it('should allow safe commands', () => {
      expect(isCommandSafe('ls -la')).toBe(true);
      expect(isCommandSafe('git status')).toBe(true);
      expect(isCommandSafe('npm run dev')).toBe(true);
      expect(isCommandSafe('cat file.txt')).toBe(true);
    });

    it('should block dangerous commands', () => {
      expect(isCommandSafe('rm -rf /')).toBe(false);
      expect(isCommandSafe('sudo rm')).toBe(false);
      expect(isCommandSafe('chmod 777 /')).toBe(false);
      expect(isCommandSafe('echo test > /dev/null')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isCommandSafe('RM -RF /')).toBe(false);
      expect(isCommandSafe('SUDO rm')).toBe(false);
    });

    it('should allow partial matches in safe context', () => {
      expect(isCommandSafe('ls -la /tmp')).toBe(true);
      expect(isCommandSafe('npm install')).toBe(true);
    });
  });
});