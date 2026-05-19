const CONTACT_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  /(https?:\/\/|www\.)\S+/,
  /(\+27|0)[6-8][0-9][\s\-]?\d{3}[\s\-]?\d{4}/,
  /\+\d{1,3}[\s\-]?\d{6,14}/,
  // Social media handles: @letter followed by 1+ alphanumeric/underscore/dot chars.
  // Starts with a letter to avoid false positives like "@3pm" or "@9am".
  /@[a-zA-Z][a-zA-Z0-9_.]{1,}/,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(pattern => pattern.test(text));
}
