# KCLS Museum Pass Booking - Authentication Flow

## Overview
This document details the complete authentication and booking flow for automated museum pass reservations. The flow involves OAuth-style redirects through libauth.com and requires session cookies.

## Authentication Flow

### Step 1: Initial Booking Request
- **URL**: `GET https://rooms.kcls.org/passes/{museumId}/book?date={date}&pass={passId}&digital=1&physical=0&location=0&token={token}`
- **Purpose**: Initiates booking, redirects to authentication if not logged in
- **Response**: 302 redirect to libauth.com

### Step 2: Library Card Authentication
- **URL**: `POST https://libauth.com/form_login`
- **Method**: POST
- **Content-Type**: `application/x-www-form-urlencoded`
- **Body Parameters**:
  ```
  auth_id=1963
  login_url=https://kcls.libapps.com/libapps/libauth?auth_id=1963
  username={library_card_number}
  password={pin}
  ```
- **Example**:
  ```
  auth_id=1963
  login_url=https%3A%2F%2Fkcls.libapps.com%2Flibapps%2Flibauth%3Fauth_id%3D1963
  username=0062638457
  password=2426
  ```
- **Response**: 303 See Other → Redirects back to booking URL with authenticated session

### Step 3: Obtain Booking Token
After authentication, the redirect URL contains the booking token:
```
https://rooms.kcls.org/passes/{museumId}/book?date={date}&pass={passId}&digital=1&physical=0&location=0&token={csrf_token}
```

**Token Example**: `1C8wSza8JDkjbGWNlEp2uwwoaqOOML1DG3ucRomgzWw8eLzWSqibNd1nDWpnjLeIw`

### Step 4: Final Booking Submission
- **URL**: `POST https://rooms.kcls.org/passes/{museumId}/book`
- **Method**: POST
- **Content-Type**: `application/x-www-form-urlencoded`
- **Body Parameters**:
  ```
  museum={museumId}
  pass={passId}
  date={yyyy-mm-dd}
  crc={checksum}
  ```
- **Example**:
  ```
  museum=14621cebb10b
  pass=9530a9fbf6f7
  date=2025-10-25
  crc=1a0828ecc7822dd54b2e410ece4d4868
  ```
- **Response**: 200 OK with success HTML

## CRC Calculation
The `crc` parameter is an MD5 hash checksum. Investigation needed for exact calculation method.

## Session Management
- Authentication creates session cookies that must be maintained throughout the flow
- Use HTTP client with cookie jar (axios with cookie support, or fetch with credentials: 'include')
- Session expires after inactivity

## Required Headers
```
Content-Type: application/x-www-form-urlencoded
Origin: https://rooms.kcls.org (for booking POST)
Referer: https://rooms.kcls.org/passes/{museumId}/book?... (for booking POST)
```

## Implementation Steps

### 1. Create Authentication Service
```typescript
interface AuthCredentials {
  username: string; // library card number
  password: string; // PIN
}

async function authenticate(credentials: AuthCredentials): Promise<CookieJar> {
  // POST to libauth.com/form_login
  // Follow redirects
  // Return session cookies
}
```

### 2. Extract Token
```typescript
async function getBookingToken(
  museumId: string,
  passId: string,
  date: string,
  cookies: CookieJar
): Promise<string> {
  // GET booking page with auth cookies
  // Parse HTML to extract token from form or URL
}
```

### 3. Calculate CRC
```typescript
function calculateCRC(museum: string, pass: string, date: string): string {
  // Algorithm TBD - likely MD5 hash of concatenated values
  // May need to reverse engineer from JavaScript on booking page
}
```

### 4. Submit Booking
```typescript
async function submitBooking(
  museumId: string,
  passId: string,
  date: string,
  crc: string,
  cookies: CookieJar
): Promise<BookingResult> {
  // POST to booking endpoint with all parameters
  // Parse success/failure response
}
```

## Security Considerations
- Store library card credentials securely (environment variables, encrypted storage)
- Never log credentials in plain text
- Session cookies should be encrypted at rest
- Implement rate limiting to avoid triggering anti-bot measures

## Error Handling
- **401/403**: Session expired or invalid credentials
- **400**: Invalid booking parameters or CRC mismatch
- **429**: Rate limited - implement backoff
- **Booking already exists**: Handle duplicate bookings gracefully

## Next Steps
1. Implement HTTP client with cookie jar
2. Create authentication service  
3. Reverse engineer CRC calculation
4. Build automated booking service
5. Add user credential management
6. Test full end-to-end flow
