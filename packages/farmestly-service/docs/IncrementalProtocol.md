# Incremental Sync Protocol

## Overview

The Incremental Sync Protocol enables the server to communicate exactly what data changed during a request, allowing the frontend to update local state without a full refresh.

### Problem

When a job syncs, the server may update multiple collections:
- Job document created
- Equipment `powerOnTime` incremented
- Field `currentCultivation` changed
- Cultivation status updated

Previously, the frontend had no way to know what changed. It relied on full `getAccountData` refreshes at key moments, causing stale data windows and unnecessary network requests.

### Solution

Endpoints track partial document updates throughout request handling and include them in the response. The frontend receives these updates and deep merges them into local state by `_id`.

---

## Response Structure

### Standard Response (unchanged)

```json
{
  "HEADERS": { "STATUS_CODE": "OK" },
  "PAYLOAD": { ... }
}
```

### Response with UPDATES

```json
{
  "HEADERS": { "STATUS_CODE": "OK" },
  "PAYLOAD": { ... },
  "UPDATES": {
    "<collection>": [
      { "_id": "<string>", "<field>": "<value>", ... }
    ]
  }
}
```

The `UPDATES` key is only present when updates were tracked. Empty updates are omitted entirely.

---

## UPDATES Contract

### Collection Names

Must exactly match frontend `farm` state keys:

| Collection | Description |
|------------|-------------|
| `fields` | Farm fields with boundaries and cultivation |
| `machines` | Tractors, vehicles |
| `attachments` | Equipment attachments (sprayers, etc.) |
| `tools` | Hand tools, implements |
| `products` | Spray products, chemicals |
| `cultivations` | Cultivation records |
| `jobTemplates` | Job templates |

### Document Requirements

| Requirement | Description |
|-------------|-------------|
| `_id` required | Every document MUST have `_id` (string or ObjectId) |
| Partial updates | Only include fields that changed, not entire documents |
| Explicit nulls | To clear a field, send `null` explicitly |
| Array replacement | Arrays are replaced entirely, not merged by index |
| Nested objects | Supported with deep merge semantics |

### Data Types

| Type | Behavior |
|------|----------|
| Primitives | Replaced |
| Objects | Deep merged (recursive) |
| Arrays | Replaced entirely |
| `null` | Sets field to null (explicit deletion) |
| `undefined` | Ignored (field unchanged) |

---

## Examples

### Simple Field Update

Track a single field change:

```js
req.trackUpdate('machines', { 
  _id: machine._id, 
  powerOnTime: 45000 
});
```

Result:
```json
{
  "UPDATES": {
    "machines": [
      { "_id": "abc123", "powerOnTime": 45000 }
    ]
  }
}
```

Frontend effect: `machines.find(m => m._id === 'abc123').powerOnTime = 45000`, other fields preserved.

---

### Nested Object Update

Update a nested field:

```js
req.trackUpdate('fields', { 
  _id: field._id, 
  currentCultivation: { 
    bbchStage: 25 
  } 
});
```

Result:
```json
{
  "UPDATES": {
    "fields": [
      { 
        "_id": "field123", 
        "currentCultivation": { 
          "bbchStage": 25 
        } 
      }
    ]
  }
}
```

Frontend effect: `field.currentCultivation.bbchStage = 25`, siblings (`id`, `crop`, `variety`, etc.) preserved.

---

### Clear Nested Object

Set an entire nested object to null:

```js
req.trackUpdate('fields', { 
  _id: field._id, 
  currentCultivation: null 
});
```

Result:
```json
{
  "UPDATES": {
    "fields": [
      { "_id": "field123", "currentCultivation": null }
    ]
  }
}
```

Frontend effect: `field.currentCultivation = null`.

---

### Clear Nested Field

Set a specific nested field to null:

```js
req.trackUpdate('fields', { 
  _id: field._id, 
  currentCultivation: { 
    preferredName: null 
  } 
});
```

Result:
```json
{
  "UPDATES": {
    "fields": [
      { 
        "_id": "field123", 
        "currentCultivation": { 
          "preferredName": null 
        } 
      }
    ]
  }
}
```

Frontend effect: `field.currentCultivation.preferredName = null`, siblings preserved.

---

### Array Replacement

Arrays are always replaced entirely (never merged by index):

```js
req.trackUpdate('products', { 
  _id: product._id, 
  tags: ['herbicide', 'corn'] 
});
```

Result:
```json
{
  "UPDATES": {
    "products": [
      { "_id": "prod123", "tags": ["herbicide", "corn"] }
    ]
  }
}
```

Frontend effect: `product.tags = ['herbicide', 'corn']` (complete replacement).

---

### Multiple Updates to Same Document

Middleware automatically merges multiple calls for the same `_id`:

```js
req.trackUpdate('machines', { _id: machine._id, powerOnTime: 100 });
req.trackUpdate('machines', { _id: machine._id, notes: 'Serviced' });
```

Result:
```json
{
  "UPDATES": {
    "machines": [
      { "_id": "abc123", "powerOnTime": 100, "notes": "Serviced" }
    ]
  }
}
```

---

### Multiple Collections

Track updates across different collections:

```js
req.trackUpdate('fields', { _id: fieldId, currentCultivation: { bbchStage: 30 } });
req.trackUpdate('machines', { _id: machineId, powerOnTime: 5000 });
req.trackUpdate('attachments', { _id: attachmentId, powerOnTime: 2000 });
req.trackUpdate('tools', { _id: toolId, powerOnTime: 1000 });
```

Result:
```json
{
  "UPDATES": {
    "fields": [{ "_id": "f1", "currentCultivation": { "bbchStage": 30 } }],
    "machines": [{ "_id": "m1", "powerOnTime": 5000 }],
    "attachments": [{ "_id": "a1", "powerOnTime": 2000 }],
    "tools": [{ "_id": "t1", "powerOnTime": 1000 }]
  }
}
```

---

### Full currentCultivation (Sow Job)

When a sow job creates a new cultivation:

```js
const currentCultivation = {
  id: cultivation._id.toString(),
  crop: cultivation.crop,
  variety: cultivation.variety,
  eppoCode: cultivation.eppoCode,
  preferredName: cultivation.preferredName,
  bbchStage: 0,
  startTime: cultivation.startTime
};

req.trackUpdate('fields', { _id: body.fieldId, currentCultivation });
```

Result:
```json
{
  "UPDATES": {
    "fields": [{
      "_id": "field123",
      "currentCultivation": {
        "id": "cult456",
        "crop": "Wheat",
        "variety": "Durum",
        "eppoCode": "TRZAX",
        "preferredName": "Triticum aestivum",
        "bbchStage": 0,
        "startTime": "2025-01-04T10:00:00.000Z"
      }
    }]
  }
}
```

---

## Backend Implementation

### Middleware: `middleware/trackUpdates.js`

```js
const trackUpdates = (req, res, next) => {
  req.updates = {};
  
  req.trackUpdate = (collection, doc) => {
    if (!doc || !doc._id) {
      console.warn('[trackUpdates] Ignoring update without _id:', collection, doc);
      return;
    }
    
    if (!req.updates[collection]) {
      req.updates[collection] = [];
    }
    
    const docId = String(doc._id);
    const existing = req.updates[collection].find(d => String(d._id) === docId);
    
    if (existing) {
      Object.assign(existing, doc);
    } else {
      req.updates[collection].push(doc);
    }
  };
  
  req.hasUpdates = () => Object.keys(req.updates).length > 0;
  
  next();
};

module.exports = trackUpdates;
```

### Response Helper: `utils/response.js`

```js
const ok = (payload, updates = null) => {
  const response = {
    HEADERS: { STATUS_CODE: 'OK' },
    PAYLOAD: payload
  };
  
  if (updates && Object.keys(updates).length > 0) {
    response.UPDATES = updates;
  }
  
  return response;
};

const fail = (code, payload = null) => ({
  HEADERS: { STATUS_CODE: code },
  PAYLOAD: payload
});

module.exports = { ok, fail };
```

### Mounting Middleware

```js
// In main router, after auth middleware
const trackUpdates = require('./middleware/trackUpdates');

router.use(sessionHandler);
router.use(trackUpdates);  // Add after session

// ... routes
```

### Usage in Endpoints

```js
router.post('/example', async (req, res) => {
  // ... do work ...
  
  // Track changes using findOneAndUpdate with returnDocument
  const result = await getDb().collection('Machines').findOneAndUpdate(
    { _id: new ObjectId(machineId), accountId },
    { $inc: { powerOnTime: deltaSeconds } },
    { returnDocument: 'after', projection: { _id: 1, powerOnTime: 1 } }
  );
  
  if (result) {
    req.trackUpdate('machines', { 
      _id: result._id, 
      powerOnTime: result.powerOnTime 
    });
  }
  
  // Pass req.updates as second argument
  res.json(ok(responsePayload, req.updates));
});
```

### Opt-In Migration

Existing endpoints continue to work unchanged:

```js
// This still works - no UPDATES in response
res.json(ok(result));
```

New/updated endpoints opt-in:

```js
// This adds UPDATES to response
res.json(ok(result, req.updates));
```

---

## Frontend Implementation

### JobService Changes

#### 1. Rename existing sync event

In `_markSynced` method, rename `'sync'` to `'jobSynced'`:

```js
async _markSynced(jobId, serverJobId) {
  // ... existing code ...
  this._emit('jobSynced', { jobId, serverJobId, status: 'synced' });  // was 'sync'
}
```

#### 2. Extract UPDATES in `_syncOne`

```js
async _syncOne(job) {
  // ... existing request code ...

  const data = await response.json();
  const serverJob = data.PAYLOAD;
  const updates = data.UPDATES || null;  // Extract UPDATES

  return {
    success: true,
    serverJobId: serverJob?.job?._id || serverJob?._id || job.id,
    serverJob,
    updates  // Pass through
  };
}
```

#### 3. Emit `updates` event in `_syncPending`

```js
if (result.success) {
  await this._removePending(job.id);
  await this._markSynced(job.id, result.serverJobId);

  // Emit updates event if present
  if (result.updates && Object.keys(result.updates).length > 0) {
    this._emit('updates', {
      jobId: job.id,
      fieldId: job.fieldId,
      updates: result.updates
    });
  }

  delete this._retryMeta[job.id];
  await this._saveRetryMeta();
}
```

### GlobalContextProvider Handler

#### Helper Functions

```js
import _ from 'lodash';

// Recursively apply nulls from source to target
const applyNulls = (target, source) => {
  Object.keys(source).forEach(key => {
    if (source[key] === null) {
      target[key] = null;
    } else if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object'
    ) {
      applyNulls(target[key], source[key]);
    }
  });
};

// Merge with array replacement (not index-based merge)
const mergeWithArrayReplace = (target, source) => {
  return _.mergeWith({}, target, source, (objValue, srcValue) => {
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
    return undefined;
  });
};
```

#### Event Handler

```js
useEffect(() => {
  const removeListener = JobService.on((event, data) => {
    if (event === 'change') {
      setActiveRecordings(JobService.getAllActive());
      
    } else if (event === 'tick') {
      setActiveRecordings(prev => {
        const recordings = JobService.getAllActive();
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(recordings);

        if (prevKeys.length !== newKeys.length) {
          return recordings;
        }

        const statusChanged = newKeys.some(key => {
          const prevRec = prev[key];
          const newRec = recordings[key];
          if (!prevRec) return true;
          return prevRec.status !== newRec.status;
        });

        return statusChanged ? recordings : prev;
      });
      
    } else if (event === 'updates') {
      const { updates } = data;
      if (!updates || typeof updates !== 'object') return;

      setFarm(prev => {
        if (!prev) return prev;
        
        const next = { ...prev };
        
        Object.entries(updates).forEach(([collection, docs]) => {
          if (!Array.isArray(docs)) {
            console.warn(`[Updates] Invalid: ${collection} is not an array`);
            return;
          }
          if (!Array.isArray(prev[collection])) {
            console.warn(`[Updates] Unknown collection: ${collection}`);
            return;
          }
          
          next[collection] = prev[collection].map(item => {
            const itemId = String(item._id);
            const update = docs.find(d => d?._id && String(d._id) === itemId);
            if (!update) return item;
            
            const merged = mergeWithArrayReplace(item, update);
            applyNulls(merged, update);
            return merged;
          });
        });
        
        return next;
      });
    }
  });

  return () => removeListener();
}, []);
```

---

## Deprecations

### Removed: `cultivationResolved` Event

Previously, JobService emitted `cultivationResolved` for sow jobs to resolve `temp_*` cultivation IDs. This is now handled by the generic `updates` event.

**Remove from JobService `_syncPending`:**
```js
// DELETE THIS BLOCK
if (job.type === 'sow' && job.cultivation?.id?.startsWith('temp_')) {
  this._emit('cultivationResolved', { ... });
}
```

**Remove from GlobalContextProvider:**
```js
// DELETE THIS BLOCK
} else if (event === 'cultivationResolved') {
  setFarmData(prev => ({ ... }));
}
```

### Renamed: `sync` → `jobSynced` Event

The existing `sync` event in `_markSynced` is renamed to `jobSynced` to avoid collision with the new `updates` event.

---

## Migration Checklist

### Backend

- [ ] Create `middleware/trackUpdates.js`
- [ ] Mount middleware after sessionHandler
- [ ] Update `utils/response.js` with new `ok()` signature
- [ ] Update `record.js` POST - track equipment powerOnTime
- [ ] Update `record.js` POST - track field currentCultivation (sow)
- [ ] Update `record.js` POST - track field currentCultivation (harvest)
- [ ] Update `record.js` PUT - track equipment powerOnTime delta
- [ ] Update `record.js` PUT - track field currentCultivation toggle
- [ ] Update `record.js` DELETE - track equipment powerOnTime decrement
- [ ] Update `record.js` DELETE - track field currentCultivation changes
- [ ] All handlers pass `req.updates` to `ok()`

### Frontend

- [ ] Add lodash import to GlobalContextProvider
- [ ] Add `applyNulls` helper function
- [ ] Add `mergeWithArrayReplace` helper function
- [ ] Rename `'sync'` to `'jobSynced'` in `_markSynced`
- [ ] Add UPDATES extraction in `_syncOne`
- [ ] Add `'updates'` event emission in `_syncPending`
- [ ] Add `'updates'` event handler in GlobalContextProvider
- [ ] Remove `cultivationResolved` emission from JobService
- [ ] Remove `cultivationResolved` handler from GlobalContextProvider
- [ ] Search codebase for `'sync'` event listeners and update

---

## Testing

### Test Cases

1. **Simple update**: Create job with machine → verify `machine.powerOnTime` updates without refresh
2. **Nested update**: Update BBCH stage → verify `field.currentCultivation.bbchStage` updates, siblings preserved
3. **Null object**: Complete harvest → verify `field.currentCultivation` becomes `null`
4. **Null field**: Clear preferredName → verify only that field nulled, siblings preserved
5. **Array replace**: Update tags → verify complete replacement, not index merge
6. **Multiple docs**: Job with machine + attachment + tool → all three update
7. **Multiple collections**: Sow job → field and equipment both update
8. **Offline sync**: Complete job offline → come online → verify updates applied
9. **Temp ID resolution**: Sow job with temp_* cultivation ID → verify real ID in currentCultivation

### Verification Steps

After each operation:
1. Check network response for `UPDATES` key
2. Verify local state updated without `getAccountData` call
3. Refresh app and verify server state matches