'use strict';

/**
 * HTTP Digest authentication (RFC 2617 / RFC 7616, MD5 and MD5-sess, qop=auth)
 * for TR-064 SOAP requests to the FritzBox.
 *
 * Replaces @mreal/digest-auth, whose dependencies (crypto-js, class-validator,
 * class-transformer) carry known vulnerabilities and are no longer maintained.
 * Uses only node:crypto.
 */

const crypto = require('crypto');

const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

/**
 * Parse a WWW-Authenticate header and return the Digest challenge parameters,
 * or null if the header contains no Digest challenge.
 */
function parseChallenge(header) {
  if (!header) return null;
  const idx = header.search(/(^|[\s,])Digest\s/i);
  if (idx === -1) return null;
  const rest = header.slice(idx).replace(/^[\s,]*Digest\s+/i, '');

  const params = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]*))/g;
  let m;
  while ((m = re.exec(rest)) !== null) {
    const key = m[1].toLowerCase();
    // A new auth scheme after the Digest parameters ends the challenge.
    if (params[key] !== undefined) break;
    params[key] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : m[3];
  }
  return params.nonce && params.realm !== undefined ? params : null;
}

const quote = (s) => `"${String(s).replace(/(["\\])/g, '\\$1')}"`;

/**
 * Build the Authorization header value for one request.
 *
 * @param {object} challenge  result of parseChallenge()
 * @param {object} opts       { username, password, method, uri, nc = 1, cnonce? }
 */
function buildAuthorization(challenge, { username, password, method, uri, nc = 1, cnonce }) {
  const algorithm = challenge.algorithm || 'MD5';
  const qops = (challenge.qop || '').split(',').map((q) => q.trim().toLowerCase());
  const qop = qops.includes('auth') ? 'auth' : undefined;
  const cn = cnonce || crypto.randomBytes(16).toString('hex');
  const ncHex = nc.toString(16).padStart(8, '0');

  let ha1 = md5(`${username}:${challenge.realm}:${password}`);
  if (/^md5-sess$/i.test(algorithm)) {
    ha1 = md5(`${ha1}:${challenge.nonce}:${cn}`);
  }
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${ncHex}:${cn}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);

  const parts = [
    `username=${quote(username)}`,
    `realm=${quote(challenge.realm)}`,
    `nonce=${quote(challenge.nonce)}`,
    `uri=${quote(uri)}`,
    `response=${quote(response)}`,
    `algorithm=${algorithm}`,
  ];
  if (challenge.opaque !== undefined) parts.push(`opaque=${quote(challenge.opaque)}`);
  if (qop) parts.push(`qop=${qop}`, `nc=${ncHex}`, `cnonce=${quote(cn)}`);

  return `Digest ${parts.join(', ')}`;
}

module.exports = { parseChallenge, buildAuthorization, md5 };
