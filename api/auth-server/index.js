/**
 * Minimal Express auth server to generate Firebase custom tokens.
 * Intended to run as a small Cloud Function or standalone Node service.
 *
 * Requirements:
 * - Set environment variable GOOGLE_APPLICATION_CREDENTIALS to service account JSON
 * - OR set FIREBASE_SERVICE_ACCOUNT (JSON string) with service account content
 */

const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');

// Init Admin SDK
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
} else {
  admin.initializeApp(); // relies on GOOGLE_APPLICATION_CREDENTIALS or env in Cloud Functions
}

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Rate limiter to prevent brute force attempts
const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use(limiter);

app.post('/customToken', async (req, res) => {
  try {
    const { code, password, companyId } = req.body || {};
    if (!code || !password) return res.status(400).send('Missing code or password');

    // Lookup user by employee code and company scope
    let usersRef = db.collection('users');
    let q = usersRef.where('employeeCode', '==', String(code));
    if (companyId) q = q.where('companyId', '==', String(companyId));
    q = q.limit(1);
    const snap = await q.get();
    if (snap.empty) return res.status(404).send('Employee not found');

    const doc = snap.docs[0];
    const user = doc.data();
    const uid = doc.id;

    if (!user.passwordHash) return res.status(403).send('No password set for user');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).send('Invalid credentials');

    // Create custom token with optional claims
    const claims = { role: user.role || 'Employee', companyId: user.companyId || companyId };
    const token = await admin.auth().createCustomToken(uid, claims);

    // Save token record for audit (short-lived)
    await db.collection('authTokens').add({
      uid,
      tokenIssued: admin.firestore.FieldValue.serverTimestamp(),
      claims,
      ip: req.ip || null,
      userAgent: req.get('User-Agent') || null
    });

    res.json({ token });
  } catch (err) {
    console.error('Auth server error', err);
    res.status(500).send('Internal Server Error');
  }
});

const port = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(port, () => console.log(`Auth server listening on ${port}`));
}

module.exports = app; // for Cloud Functions or testing
