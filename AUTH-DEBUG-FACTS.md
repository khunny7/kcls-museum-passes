# KCLS Authentication Debug - Known Facts

## Test Credentials
- Redacted (remove personal card/PIN before sharing)

## The Problem
POST to `https://libauth.com/form_login` returns `result=0` (auth success) but redirects to login page instead of booking URL with token.

---

## TESTED AND RULED OUT

### ❌ 1. URL-decoding dest cookie when SENDING (getCookieHeader)
**Tested:** 2025-12-08
**Result:** FAILED - Corrupted the base64 value
**Conclusion:** Wrong approach

### ❌ 2. Sending cookies exactly as received (no decoding at all)
**Tested:** 2025-12-08
**Result:** FAILED - dest had %2F, server returned result=0 but no token
**Conclusion:** Needs more investigation

### ❌ 3. URL-decoding dest cookie when STORING (storeCookiesFromResponse)  
**Tested:** 2025-12-08
**Result:** FAILED - dest correctly decoded (no %2F, has / and ?), but server still returns result=0 with redirect to callback, not booking URL
**Conclusion:** Decoding doesn't help either

### Current state: Reverted to storing cookies as-is (no decoding)

---

## CONFIRMED FACTS

### 1. SIP2 Authentication SUCCEEDS
- Server returns `result=0` which means library card/PIN validated correctly
- The POST itself works, credentials are correct

### 2. The redirect after auth goes to login page, not booking URL
- Expected: Redirect to `rooms.kcls.org/passes/.../book?...&libauth_token=XXX`
- Actual: Redirect to `kcls.libapps.com/libapps/libauth?auth_id=1963` (login form)

### 3. All 6 cookies ARE being sent
- session hash, type, app, lid, auth_id, dest - all present in POST

### 4. Target vs Dest encoding difference
- Target from rooms.kcls.org has `/` at position 63
- Dest from libauth.com Set-Cookie has `%2F` at position 63
- libauth.com URL-encodes the value when storing as cookie

---

## REMAINING HYPOTHESES

1. **Session state mismatch** - The session hash cookie value doesn't match what server expects
2. **Missing cookie** - Some cookie is not being stored/sent that should be
3. **Cookie domain/path issue** - Cookies not sent to correct domain
4. **Header difference** - Some other header is different between browser and our request

---

## Next Action
Need to compare EXACT headers browser sends vs what we send. HAR doesn't show Cookie header contents for HttpOnly cookies.
