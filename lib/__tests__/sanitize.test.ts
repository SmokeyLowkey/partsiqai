import { describe, it, expect } from 'vitest';
import { escapeHtml, stripHtml } from '../sanitize';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it('should return empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null as any)).toBe('');
    expect(escapeHtml(undefined as any)).toBe('');
  });

  it('should pass through safe strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('Part #12345')).toBe('Part #12345');
  });

  it('should escape img onerror XSS payload', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it('should escape event handler attributes', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe(
      '&quot; onmouseover=&quot;alert(1)'
    );
  });
});

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    expect(stripHtml('<b>bold</b>')).toBe('bold');
    expect(stripHtml('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('should handle nested tags', () => {
    expect(stripHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('should return empty string for falsy input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null as any)).toBe('');
  });

  it('should pass through plain text unchanged', () => {
    expect(stripHtml('Hello World')).toBe('Hello World');
  });
});
