/**
 * Security Test Utilities for EnvSync
 *
 * Provides payloads and utilities for security testing:
 * - XSS attack vectors
 * - SQL injection payloads
 * - Path traversal attempts
 * - Authentication bypass vectors
 */

// ============================================================================
// XSS Attack Payloads
// ============================================================================

export const XSS_PAYLOADS = {
  basic: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    '<body onload=alert("XSS")>',
    '<iframe src="javascript:alert(\'XSS\')">',
  ],

  encoded: [
    '&lt;script&gt;alert("XSS")&lt;/script&gt;',
    '&#60;script&#62;alert("XSS")&#60;/script&#62;',
    '%3Cscript%3Ealert("XSS")%3C/script%3E',
    '\\x3cscript\\x3ealert("XSS")\\x3c/script\\x3e',
    '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e',
  ],

  eventHandlers: [
    '" onmouseover="alert(\'XSS\')"',
    "' onclick='alert(1)'",
    '" onfocus="alert(1)" autofocus="',
    "' onload='alert(1)'",
    '" onerror="alert(1)"',
  ],

  polyglot: [
    "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcLiCk=alert() )//",
    '"><img src=x onerror=alert(1)//><"',
    '\'"><script>alert(1)</script>',
    '<img/src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
  ],

  angular: [
    '{{constructor.constructor("alert(1)")()}}',
    '{{$on.constructor("alert(1)")()}}',
    '{{a]constructor.prototype.b]constructor.constructor("alert(1)")()}}',
  ],

  dataUrls: [
    'data:text/html,<script>alert("XSS")</script>',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgiWFNTIik8L3NjcmlwdD4=',
  ],
};

// ============================================================================
// SQL Injection Payloads
// ============================================================================

export const SQL_INJECTION_PAYLOADS = {
  authentication: [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' OR '1'='1' /*",
    "admin'--",
    "admin' #",
    "') OR ('1'='1",
    "' OR 1=1 --",
  ],

  union: [
    "' UNION SELECT * FROM users --",
    "' UNION SELECT username, password FROM users --",
    "' UNION ALL SELECT NULL, NULL, NULL --",
    "1 UNION SELECT 1,2,3,4,5,6,7,8,9,10 --",
  ],

  stacked: [
    "'; DROP TABLE users; --",
    "'; DELETE FROM projects; --",
    "'; UPDATE users SET admin=1 WHERE '1'='1",
    "'; INSERT INTO users VALUES ('hacker','password'); --",
  ],

  blind: [
    "' AND SLEEP(5) --",
    "' AND (SELECT COUNT(*) FROM users) > 0 --",
    "1' AND '1'='1",
    "1' AND '1'='2",
  ],

  errorBased: [
    "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()))) --",
    "' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT version()),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
  ],
};

// ============================================================================
// Path Traversal Payloads
// ============================================================================

export const PATH_TRAVERSAL_PAYLOADS = {
  unix: [
    '../../../etc/passwd',
    '....//....//....//etc/passwd',
    '../../../etc/shadow',
    '/etc/passwd',
    '../../../root/.ssh/id_rsa',
  ],

  windows: [
    '..\\..\\..\\windows\\system32\\config\\sam',
    '..\\..\\..\\windows\\system.ini',
    '....\\\\....\\\\....\\\\windows\\\\win.ini',
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
  ],

  encoded: [
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '..%252f..%252f..%252fetc/passwd',
    '%c0%ae%c0%ae/%c0%ae%c0%ae/%c0%ae%c0%ae/etc/passwd',
    '..%00/etc/passwd',
  ],

  nullByte: [
    '../../../etc/passwd%00.txt',
    '../../../etc/passwd\x00.png',
    '../../../etc/passwd%00',
  ],
};

// ============================================================================
// Authentication Bypass Payloads
// ============================================================================

export const AUTH_BYPASS_PAYLOADS = {
  jwt: [
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  ],

  headers: [
    { 'X-Forwarded-For': '127.0.0.1' },
    { 'X-Real-IP': '127.0.0.1' },
    { 'X-Original-URL': '/admin' },
    { 'X-Rewrite-URL': '/admin' },
    { 'X-Custom-IP-Authorization': '127.0.0.1' },
  ],

  paths: [
    '/admin',
    '/admin/',
    '/Admin',
    '/ADMIN',
    '/admin/./.',
    '/./admin',
    '/admin%20',
    '/admin%00',
    '/%61dmin',
  ],
};

// ============================================================================
// Command Injection Payloads
// ============================================================================

export const COMMAND_INJECTION_PAYLOADS = [
  '; ls -la',
  '| cat /etc/passwd',
  '`id`',
  '$(whoami)',
  '& dir',
  '|| echo vulnerable',
  '; sleep 5',
  '| ping -c 5 127.0.0.1',
];

// ============================================================================
// SSRF Payloads
// ============================================================================

export const SSRF_PAYLOADS = [
  'http://localhost/',
  'http://127.0.0.1/',
  'http://[::1]/',
  'http://0.0.0.0/',
  'http://169.254.169.254/latest/meta-data/',
  'http://metadata.google.internal/',
  'file:///etc/passwd',
  'dict://localhost:11211/stat',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a response contains any XSS payload reflection
 */
export function checkXSSReflection(content: string, payload: string): boolean {
  // Check if payload is reflected without encoding
  if (content.includes(payload)) {
    return true;
  }

  // Check for partial reflections
  const dangerousPatterns = ['<script', 'onerror=', 'onload=', 'javascript:'];
  for (const pattern of dangerousPatterns) {
    if (payload.toLowerCase().includes(pattern) && content.toLowerCase().includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if input is properly sanitized
 */
export function isSanitized(input: string, output: string): boolean {
  // Check if dangerous characters are encoded
  const dangerous = ['<', '>', '"', "'", '&'];
  const encoded = ['&lt;', '&gt;', '&quot;', '&#39;', '&amp;'];

  for (let i = 0; i < dangerous.length; i++) {
    if (input.includes(dangerous[i]) && output.includes(dangerous[i])) {
      // Dangerous character not encoded
      return false;
    }
  }

  return true;
}

/**
 * Generate random test data
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate fuzzing payloads
 */
export function* generateFuzzPayloads(): Generator<string> {
  // Empty and whitespace
  yield '';
  yield ' ';
  yield '\t';
  yield '\n';
  yield '\r\n';

  // Null bytes
  yield '\x00';
  yield 'test\x00test';

  // Long strings
  yield 'A'.repeat(1000);
  yield 'A'.repeat(10000);
  yield 'A'.repeat(100000);

  // Special characters
  yield '<>"\'/\\';
  yield '!@#$%^&*()';
  yield '{}[]|`;:?,';

  // Unicode
  yield '\uFEFF';
  yield '\u202E';
  yield '\uD800\uDC00';

  // Format strings
  yield '%s%s%s%s';
  yield '%n%n%n%n';
  yield '%x%x%x%x';

  // Numbers
  yield '0';
  yield '-1';
  yield '9999999999999999999';
  yield '1e308';
  yield 'NaN';
  yield 'Infinity';

  // Booleans
  yield 'true';
  yield 'false';
  yield 'null';
  yield 'undefined';
}

/**
 * Timing attack detection helper
 */
export async function measureTiming(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/**
 * Check for timing differences (potential timing attack vulnerability)
 */
export async function detectTimingVulnerability(
  correctFn: () => Promise<void>,
  incorrectFn: () => Promise<void>,
  iterations: number = 10
): Promise<boolean> {
  const correctTimes: number[] = [];
  const incorrectTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    correctTimes.push(await measureTiming(correctFn));
    incorrectTimes.push(await measureTiming(incorrectFn));
  }

  const avgCorrect = correctTimes.reduce((a, b) => a + b) / iterations;
  const avgIncorrect = incorrectTimes.reduce((a, b) => a + b) / iterations;

  // If difference is more than 50%, might be vulnerable
  const ratio = Math.max(avgCorrect, avgIncorrect) / Math.min(avgCorrect, avgIncorrect);
  return ratio > 1.5;
}
