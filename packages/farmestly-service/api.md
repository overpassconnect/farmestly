# API Error Handling System

## Overview

Centralized API error handling via the `useApi` hook. All API errors are automatically displayed in translated bottomsheets — no manual error handling required in components.

## Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         Component                               │
│                                                                 │
│   const { api } = useApi();                                     │
│   const { ok, data } = await api('/endpoint', { method: 'GET'});│
│   if (ok) { /* success */ }                                     │
│   // errors auto-handled                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        useApi Hook                              │
├─────────────────────────────────────────────────────────────────┤
│  • Wraps globals/api.js                                         │
│  • Normalizes response to { ok, data, code, validation, raw }   │
│  • Auto-shows translated bottomsheet on errors                  │
│  • Auto-logout on SIGNED_OUT                                    │
│  • Suppresses errors when offline                               │
│  • Skips bottomsheet when validation present (FormikHelper)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Server Response                             │
├─────────────────────────────────────────────────────────────────┤
│  Success:                                                       │
│  { HEADERS: { STATUS_CODE: 'OK' }, PAYLOAD: { ... } }           │
│                                                                 │
│  Error:                                                         │
│  { HEADERS: { STATUS_CODE: 'ERROR_CODE', VALIDATION: [...] },   │
│    PAYLOAD: { dynamicData } }                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Usage

### Basic GET/POST
```js
const { api } = useApi();

// GET
const { ok, data } = await api('/profile');
if (ok) setProfile(data);

// POST
const { ok, data } = await api('/field', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'North Field', points: [...] })
});
if (ok) setFarmData(data);

// Errors auto-displayed via bottomsheet — no else block needed
```

### Forms with Validation (FormikHelper)
```js
const { api } = useApi();

<FormikHelper
  onSubmit={async (values) => {
    const { ok, raw } = await api('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });

    if (ok) {
      navigation.navigate('Main');
      return;
    }

    // Return raw for FormikHelper to handle field-level validation errors
    return raw;
  }}
>
```

### Non-Hook Contexts (Services)

For code outside React components (e.g., `JobRecordingService`), use raw API:
```js
import { api } from '../globals/api';

// Raw api — no auto error handling
const res = await api('/sync', { method: 'POST', body: ... });
const data = await res.json();
```

## Response Shape
```js
{
  ok: boolean,           // true if STATUS_CODE === 'OK'
  data: any,             // PAYLOAD from server
  code: string,          // STATUS_CODE or HTTP fallback
  validation: array,     // VALIDATION array for FormikHelper
  status: number,        // HTTP status code
  raw: object            // Full original response (for FormikHelper)
}
```

## Error Handling Flow

| Scenario | Bottomsheet | Notes |
|----------|-------------|-------|
| `STATUS_CODE: 'OK'` | ✗ | Success |
| `STATUS_CODE: 'ERROR_CODE'` | ✓ | Auto-translated message |
| `STATUS_CODE` with `VALIDATION` | ✗ | FormikHelper handles |
| `STATUS_CODE: 'SIGNED_OUT'` | ✗ | Auto-logout + redirect |
| No JSON body (nginx 502/503/504) | ✓ | HTTP fallback message |
| Network failure | ✓ | `NETWORK_ERROR` message |
| Offline mode | ✗ | All errors suppressed |

## Dynamic Error Messages

Errors with dynamic data use i18n interpolation. Server payload is passed to translations:

**Server response:**
```js
fail('CULTIVATION_HAS_DEPENDENT_JOBS', { dependentJobCount: 3 })
```

**Translation:**
```json
{
  "CULTIVATION_HAS_DEPENDENT_JOBS": "Delete {{dependentJobCount}} linked job(s) first."
}
```