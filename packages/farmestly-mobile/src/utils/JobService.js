

import { Storage } from './storage';
import { api } from '../globals/api';
import config from '../globals/config';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const BASE_URL = config.BASE_URL;

// ============================================================
// CONFIGURATION
// ============================================================

const STORAGE = {
	ACTIVE: '@jobs:active',
	PENDING: '@jobs:pending',
	COMPLETING: '@jobs:completing',
	CACHE_PREFIX: '@jobs:cache:',
	INDEX: '@jobs:index',
	META: '@jobs:meta',
	BATCH_PENDING: '@JobService:batchPending',
	RETRY_META: '@jobs:retryMeta',
};

const CONFIG = {
	TIMER_INTERVAL_MS: 1000,
	SAVE_INTERVAL_TICKS: 10,       // Save active recordings every 10 seconds
	MAX_ACTIVE_PER_FIELD: 1,
	MAX_ACTIVE_TOTAL: 10,
	MAX_CACHED_PER_FIELD: 100,
	CACHE_TTL_DAYS: 90,
	CLEANUP_INTERVAL_MS: 3600000,  // 1 hour
	HYDRATION_INTERVAL_MS: 86400000, // 24 hours
	BATCH_SIZE: 50,
	// Retry configuration
	SYNC_RETRY_BASE_DELAY_MS: 2000,      // Start with 2 seconds
	SYNC_RETRY_MAX_DELAY_MS: 300000,     // Cap at 5 minutes
	SYNC_RETRY_MAX_ATTEMPTS: 10,         // Max retries per job
	SYNC_RETRY_JITTER_FACTOR: 0.2,       // 20% jitter to prevent thundering herd
	SYNC_BACKGROUND_INTERVAL_MS: 60000,  // Background sync every 60 seconds
	SYNC_BACKOFF_MULTIPLIER: 2,          // Exponential backoff multiplier
};

// ============================================================
// HELPERS
// ============================================================

const str = (id) => String(id);
const uid = (prefix = 'job') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

// ============================================================
// JOB SERVICE
// ============================================================
/**
 * JobService.js
 *
 * Singleton service that manages job recordings, local caching, and reliable
 * server synchronization for field-level jobs (sprays, irrigation, harvests, etc.).
 *
 * Key responsibilities:
 *  - Maintain in-memory active recordings and persist them to Storage
 *  - Cache completed jobs and maintain an index for quick queries (by field and by type)
 *  - Enqueue completed jobs for server sync with idempotency and exponential backoff
 *  - Support multi-field batch workflows (startBatch / advanceBatch / completeBatch)
 *  - Provide crash-recovery for interrupted completions and debug helpers
 *
 * Storage Keys:
 *   @jobs:active           → { fieldId: recording, ... }
 *   @jobs:pending          → [ job, job, ... ]  (server sync queue)
 *   @jobs:completing       → [ { id, job }, ... ]  (crash recovery)
 *   @jobs:cache:{id}       → { ...job }  (completed jobs)
 *   @jobs:index            → { byField: { fid: [ids] }, byType: { type: [ids] } }
 *   @jobs:meta             → { lastHydration }
 *   @JobService:batchPending → Active batch state for multi-field jobs
 *   @jobs:retryMeta        → Retry scheduling metadata for failed syncs
 *
 * Public API (selected):
 *   initialize(fieldIds?) → Promise<boolean>
 *   start(fieldId, jobType, jobData?) → Promise<recording>
 *   pause(fieldId) → Promise<boolean>
 *   resume(fieldId) → Promise<boolean>
 *   stop(fieldId) → Promise<job|null>
 *   startBatch(jobPayloads) → Promise<recording>
 *   advanceBatch(nextFieldId) → Promise<recording>
 *   completeBatch() → Promise<job>
 *   getBatchStatus(), isBatchActive(), isFieldInActiveBatch(fieldId)
 *   getActive(fieldId), getAllActive(), hasActive(fieldId)
 *   getHistory(fieldId, options), getByType(type, options)
 *   getPendingJobs(), clearBatchPending(), hydrate(fieldIds), getStats()
 *   reset(), cleanup(), on/addListener(callback)
 *
 * Events emitted via `on(callback)`:
 *   'ready'     : initialization finished (no data)
 *   'tick'      : timer tick, data = snapshot from getAllActive()
 *   'change'    : lifecycle or load/reset events, payloads like { type, fieldId, recording/job }
 *   'jobSynced' : emitted when a job is marked synced; data = { jobId, serverJobId, status }
 *   'sync'      : emitted when server returns UPDATES; data = { jobId, fieldId, updates }
 *
 * Notes:
 *  - Completed jobs are stored locally and remain in the pending queue until
 *    successfully synced to the server (retries use exponential backoff + jitter).
 *  - A 'completing' queue is used to ensure crash-safe completion; interrupted
 *    completions are recovered on initialization.
 *  - The service is exported as a singleton and safe to call from multiple parts
 *    of the app (it will initialize lazily).
 *
 * Usage example:
 *   import JobService from './utils/JobService';
 *   await JobService.initialize(['field-1']);
 *   const unsubscribe = JobService.on((event, data) => { handle events  });
 *   const rec = await JobService.start('field-1', 'spray', { fieldName: 'A', sprayData: { ... }});
 *   await JobService.stop('field-1');
 *   unsubscribe();
 *
 * @version 2.1.1
 */
class JobService {
	constructor() {
		// State
		this._active = new Map();      // fieldId → recording
		this._listeners = new Set();
		this._index = { byField: new Map(), byType: new Map() };
		this._batchPending = null;     // Batch queue object when multi-field batch is active

		// Timers
		this._timer = null;
		this._cleanupTimer = null;
		this._tickCount = 0;

		// Flags
		this._initialized = false;
		this._initPromise = null;
		this._syncing = false;
		this._stopping = new Set();    // fieldIds currently being stopped

		// Retry state
		this._retryMeta = {};          // jobId → { attempts, lastAttempt, nextRetry }
		this._syncTimer = null;        // Background sync timer
		this._netInfoUnsubscribe = null;
		this._appStateSubscription = null;
	}

	// ============================================================
	// INITIALIZATION
	// ============================================================

	/**
	 * Initialize the service. Safe to call multiple times.
	 * @param {string[]} [fieldIds] - Field IDs for hydration
	 */
	async initialize(fieldIds = null) {
		if (this._initPromise) return this._initPromise;

		this._initPromise = this._doInit(fieldIds);
		return this._initPromise;
	}

	async _doInit(fieldIds) {
		console.log('[JobService] Initializing...');

		try {
			// 1. Load index
			await this._loadIndex();

			// 2. Recover any interrupted completions
			await this._recoverCompletions();

			// 3. Load active recordings and recover elapsed time
			await this._loadActive();

			// 4. Load batch pending state
			await this._loadBatchPending();

			// 5. Start timer if needed
			if (this._hasRunning()) {
				this._startTimer();
			}

			// 6. Start cleanup timer
			this._startCleanupTimer();

			// 7. Load retry metadata
			await this._loadRetryMeta();

			// 8. Setup network and app state listeners
			this._setupNetworkListener();
			this._setupAppStateListener();

			// 9. Start background sync timer
			this._startBackgroundSync();

			// 10. Mark initialized
			this._initialized = true;
			console.log('[JobService] Initialized');
			this._emit('ready');

			// 11. Background tasks (don't await)
			this._syncPending().catch(e => console.error('[JobService] Sync failed:', e));

			if (fieldIds?.length) {
				this._hydrate(fieldIds).catch(e => console.error('[JobService] Hydration failed:', e));
			}

			return true;
		} catch (err) {
			console.error('[JobService] Init failed:', err);
			this._initPromise = null;
			return false;
		}
	}

	async _ensureInit() {
		if (!this._initialized) {
			await this.initialize();
		}
	}

	// ============================================================
	// PUBLIC API: RECORDING LIFECYCLE
	// ============================================================

	/**
	 * Start a new job recording.
	 *
	 * Creates an in-memory recording for the given `fieldId`, starts the internal
	 * timer if necessary, persists active recordings to Storage and emits
	 * a `'change'` event with { type: 'start', fieldId, recording }.
	 *
	 * @param {string|number} fieldId - Field ID (ObjectId string) to record against.
	 * @param {string} type - Job type (e.g. 'sow', 'harvest', 'spray', 'irrigate', 'custom').
	 * @param {Object} [jobData={}] - Optional job payload with template, machine, attachment, tool, cultivation, data, notes.
	 * @returns {Promise<Object>} Resolves to the created recording object.
	 * @throws {Error} If a recording already exists for the field or the max concurrent recordings limit is reached.
	 */
	async start(fieldId, type, jobData = {}) {
		await this._ensureInit();
		const fid = str(fieldId);

		if (this._active.has(fid)) {
			throw new Error(`Recording already active for field ${fid}`);
		}
		if (this._active.size >= CONFIG.MAX_ACTIVE_TOTAL) {
			throw new Error(`Max ${CONFIG.MAX_ACTIVE_TOTAL} concurrent recordings`);
		}

		// Build recording object with new schema
		const recording = {
			id: uid(),
			fieldId: fid,
			fieldName: jobData.fieldName || '',  // Field display name
			fieldArea: jobData.fieldArea || 0,   // Field area for calculations
			type,  // Renamed from jobType
			template: jobData.template || null,  // { id, name } | null
			machine: jobData.machine || null,    // { id, name, make } | null
			attachment: jobData.attachment || null,  // { id, name, type } | null
			tool: jobData.tool || null,          // { id, name, brand } | null
			cultivation: jobData.cultivation || null,  // { id, crop, variety } | null
			batch: jobData.batch || null,        // { id, fieldIndex, totalFields, fieldIds } | null
			startedAt: now(),  // Renamed from startTime
			endedAt: null,     // Renamed from endTime
			elapsedTime: 0,
			status: 'running',  // 'running' | 'paused' | 'completed'
			lastTick: Date.now(),
			idempotencyKey: uid('idem'),
			timestamps: [{ action: 'start', time: now() }],
			data: {
				sow: jobData.data?.sow || null,
				harvest: jobData.data?.harvest || null,
				spray: jobData.data?.spray || null,
				irrigate: jobData.data?.irrigate || null,
				...jobData.data,  // Spread any additional data
			},
			notes: jobData.notes || '',
		};

		this._active.set(fid, recording);
		await this._saveActive();

		if (!this._timer) {
			this._startTimer();
		}

		this._emit('change', { type: 'start', fieldId: fid, recording });
		return recording;
	}

	/**
	 * Pause a running recording.
	 *
	 * Sets the recording status to `'paused'`, records a timestamp and persists
	 * the active state. Emits a `'change'` event with { type: 'pause', fieldId, recording }.
	 *
	 * @param {string|number} fieldId - Field ID for the recording to pause.
	 * @returns {Promise<boolean>} Resolves to `true` if pause happened, `false` if there was no running recording.
	 */
	async pause(fieldId) {
		await this._ensureInit();
		const fid = str(fieldId);
		const rec = this._active.get(fid);

		if (!rec || rec.status !== 'running') return false;

		rec.status = 'paused';
		rec.lastTick = Date.now();
		rec.timestamps.push({ action: 'pause', time: now() });

		if (!this._hasRunning()) {
			this._stopTimer();
		}

		await this._saveActive();
		this._emit('change', { type: 'pause', fieldId: fid, recording: rec });
		return true;
	}

	/**
	 * Resume a paused recording.
	 *
	 * Sets the recording status to `'running'`, updates timestamps and restarts
	 * the timer if necessary. Emits a `'change'` event with { type: 'resume', fieldId, recording }.
	 *
	 * @param {string|number} fieldId - Field ID for the recording to resume.
	 * @returns {Promise<boolean>} Resolves to `true` if resume happened, `false` if there was no paused recording.
	 */
	async resume(fieldId) {
		await this._ensureInit();
		const fid = str(fieldId);
		const rec = this._active.get(fid);

		if (!rec || rec.status !== 'paused') return false;

		rec.status = 'running';
		rec.lastTick = Date.now();
		rec.timestamps.push({ action: 'resume', time: now() });

		if (!this._timer) {
			this._startTimer();
		}

		await this._saveActive();
		this._emit('change', { type: 'resume', fieldId: fid, recording: rec });
		return true;
	}

	/**
	 * Stop and complete a recording.
	 *
	 * Finalizes a running or paused recording, moves it to the local cache,
	 * enqueues it for server sync and emits a `'change'` event with { type: 'stop', fieldId, job }.
	 * This method uses a 'completing' queue to protect against crashes during
	 * completion and will attempt to recover interrupted completions on init.
	 *
	 * @param {string|number} fieldId - Field ID to stop recording for.
	 * @returns {Promise<Object|null>} The completed job object or `null` if there was no active recording or a stop is already in progress.
	 */
	async stop(fieldId) {
		await this._ensureInit();
		const fid = str(fieldId);

		// Prevent duplicate stops
		if (this._stopping.has(fid)) {
			console.warn('[JobService] Stop already in progress for', fid);
			return null;
		}

		const rec = this._active.get(fid);
		if (!rec) return null;

		this._stopping.add(fid);

		try {
			// Finalize recording
			const completedJob = {
				...rec,
				endedAt: now(),  // Renamed from endTime
				status: 'completed',
				timestamps: [...rec.timestamps, { action: 'stop', time: now() }],
			};

			// Save to completing queue (crash recovery)
			await this._addCompleting(completedJob);

			// Remove from active
			this._active.delete(fid);
			if (this._active.size === 0) {
				this._stopTimer();
			}
			await this._saveActive();

			// Add to local cache
			await this._cacheJob(completedJob);

			// Add to sync queue
			await this._addPending(completedJob);

			// Remove from completing queue
			await this._removeCompleting(completedJob.id);

			this._emit('change', { type: 'stop', fieldId: fid, job: completedJob });

			// Trigger sync (fire and forget)
			this._syncPending().catch(e => console.error('[JobService] Sync failed:', e));

			return completedJob;
		} finally {
			this._stopping.delete(fid);
		}
	}

	// ============================================================
	// PUBLIC API: BATCH OPERATIONS
	// ============================================================

	/**
	 * Start a multi-field batch job.
	 *
	 * Initializes internal batch state (shared config and pending fields), saves
	 * it to storage and immediately starts the first field's recording using
	 * the normal `start()` flow. The batch state is used by `advanceBatch` and
	 * `completeBatch` to continue or finish the batch.
	 *
	 * @param {Array<Object>} jobPayloads - Array of job payload objects produced by the batch demuxer. The first payload is started immediately.
	 * @returns {Promise<Object>} Resolves to the recording object for the first field in the batch.
	 * @throws {Error} If `jobPayloads` is not a non-empty array.
	 */
	async startBatch(jobPayloads) {
		await this._ensureInit();

		if (!Array.isArray(jobPayloads) || jobPayloads.length === 0) {
			throw new Error('jobPayloads must be a non-empty array');
		}

		// Extract first payload to start immediately
		const firstPayload = jobPayloads[0];
		const remainingPayloads = jobPayloads.slice(1);

		// Determine job type from data.spray or data.irrigate
		const isSpray = !!firstPayload.data?.spray;
		const isIrrigate = !!firstPayload.data?.irrigate;

		let jobType;
		let sharedConfig;

		if (isSpray) {
			jobType = 'spray';
			sharedConfig = {
				sprayerId: firstPayload.data.spray.sprayerId,
				sprayerName: firstPayload.data.spray.sprayerName,
				sprayerType: firstPayload.data.spray.sprayerType,
				tankCapacity: firstPayload.data.spray.tankCapacity,
				carrierRate: firstPayload.data.spray.carrierRate,
				products: firstPayload.data.spray.products,
				complianceInfo: firstPayload.data.spray.complianceInfo,
			};
		} else if (isIrrigate) {
			jobType = 'irrigate';
			sharedConfig = {
				irrigatorId: firstPayload.data.irrigate.irrigatorId,
				irrigatorName: firstPayload.data.irrigate.irrigatorName,
				litersPerHour: firstPayload.data.irrigate.litersPerHour,
			};
		} else {
			jobType = 'custom';
			sharedConfig = {};
		}

		// Build batch pending object
		this._batchPending = {
			id: firstPayload.batch.id,
			type: jobType,  // Use 'type', not 'jobType'
			totalArea: firstPayload.batch.totalArea,
			// Normalize fieldIds to strings to avoid type inconsistencies
			fieldIds: (firstPayload.batch.fieldIds || []).map(str),
			sharedConfig,

			// Store top-level equipment references for rebuilding payloads
			template: firstPayload.template || null,
			machine: firstPayload.machine || null,
			attachment: firstPayload.attachment || null,
			tool: firstPayload.tool || null,

			// Track cumulative elapsed time across all fields in batch
			accumulatedTime: 0,
			batchStartTime: Date.now(),

			// Pending fields (field-specific data only) - normalize fieldId
			// Store full cultivation object, not just ID
			pending: remainingPayloads.map(p => ({
				fieldId: str(p.fieldId),
				fieldName: p.fieldName,
				fieldArea: p.fieldArea,
				fieldIndex: p.batch.fieldIndex,
				cultivation: p.cultivation || null,  // Full object, not just ID
			})),
		};

		await this._saveBatchPending();

		// Build jobData for the first field
		const jobData = {
			fieldName: firstPayload.fieldName,
			fieldArea: firstPayload.fieldArea,
			cultivation: firstPayload.cultivation,
			template: firstPayload.template,
			machine: firstPayload.machine,
			attachment: firstPayload.attachment,
			tool: firstPayload.tool,
			batch: firstPayload.batch,
			data: firstPayload.data,  // Pass through data.spray or data.irrigate as-is
		};

		return await this.start(firstPayload.fieldId, jobType, jobData);
	}

	/**
	 * Complete the current field and advance to the next field in the active batch.
	 *
	 * Stops the active recording, removes the selected field from the pending
	 * list and then starts the next field as a new recording (preserving batch
	 * metadata). If this was the last pending field the batch state is cleared.
	 *
	 * @param {string|number} nextFieldId - ID of the next field to start.
	 * @returns {Promise<Object>} The newly started recording object.
	 * @throws {Error} If there is no active batch, the specified field is not in
	 *                 the batch pending list, or there is no active recording to complete.
	 */
	async advanceBatch(nextFieldId) {
		await this._ensureInit();

		if (!this._batchPending) {
			throw new Error('No active batch');
		}

		const nfid = str(nextFieldId);
		const pendingEntry = this._batchPending.pending.find(p => str(p.fieldId) === nfid);

		if (!pendingEntry) {
			throw new Error(`Field ${nfid} not found in batch pending list`);
		}

		// Get current active field ID
		const currentFieldId = Array.from(this._active.keys())[0];
		if (!currentFieldId) {
			throw new Error('No active recording to complete');
		}

		// Get the elapsed time from the current recording before stopping
		const currentRecording = this._active.get(currentFieldId);
		const fieldElapsedTime = currentRecording?.elapsedTime || 0;

		try {
			// Accumulate elapsed time from completed field
			this._batchPending.accumulatedTime = (this._batchPending.accumulatedTime || 0) + fieldElapsedTime;

			// Complete current recording (triggers sync)
			await this.stop(currentFieldId);

			// Remove from pending list
			this._batchPending.pending = this._batchPending.pending.filter(p => str(p.fieldId) !== nfid);

			// Check if this is the last field in the batch
			const isLastField = this._batchPending.pending.length === 0;
			const jobType = this._batchPending.type;

			// Rebuild jobData from pending entry + stored shared config
			const jobData = {
				fieldName: pendingEntry.fieldName,
				fieldArea: pendingEntry.fieldArea,
				cultivation: pendingEntry.cultivation,
				template: this._batchPending.template,
				machine: this._batchPending.machine,
				attachment: this._batchPending.attachment,
				tool: this._batchPending.tool,
				batch: {
					id: this._batchPending.id,
					fieldIndex: pendingEntry.fieldIndex,
					totalArea: this._batchPending.totalArea,
					fieldIds: this._batchPending.fieldIds,
				},
				data: {},
			};

			// Build type-specific data under data.*
			if (jobType === 'spray') {
				jobData.data.spray = {
					...this._batchPending.sharedConfig,
					fieldArea: pendingEntry.fieldArea,  // Field-specific
				};
			} else if (jobType === 'irrigate') {
				jobData.data.irrigate = {
					...this._batchPending.sharedConfig,
				};
			}

			// Clear batch state if this is the last field
			if (isLastField) {
				console.log('[JobService] Last field in batch, clearing batch state');
				this._batchPending = null;
			}

			await this._saveBatchPending();

			// Start new recording
			return await this.start(nextFieldId, jobType, jobData);
		} catch (error) {
			// On error, save the current batch state (with updated pending list if stop succeeded)
			console.error('[JobService] Error during batch advance:', error);
			await this._saveBatchPending();
			throw error;
		}
	}

	/**
	 * Complete the current field and end the batch.
	 *
	 * Stops the active recording for the current field, clears the batch state
	 * (discarding any remaining pending fields) and returns the completed job.
	 * Use this to abort the remainder of a batch once the current field is done.
	 *
	 * @returns {Promise<Object>} The completed job for the current field.
	 * @throws {Error} If there is no active batch or there is no active recording to complete.
	 */
	async completeBatch() {
		console.log('[JobService] completeBatch called');
		await this._ensureInit();

		console.log('[JobService] Completing batch...');
		if (!this._batchPending) {
			throw new Error('No active batch');
		}

		console.log('[JobService] Completing batch:', this._batchPending.id);
		console.log('[JobService] Active recordings:', Array.from(this._active.keys()));
		console.log('[JobService] Batch pending fields:', this._batchPending.fieldIds);

		// Get current active field ID
		const currentFieldId = Array.from(this._active.keys())[0];
		if (!currentFieldId) {
			// Clear batch state even if no active recording
			console.warn('[JobService] No active recording found, clearing batch state anyway');
			console.warn('[JobService] Batch had:', this._batchPending);
			this._batchPending = null;
			await this._saveBatchPending();
			throw new Error('No active recording to complete');
		}

		try {
			// Complete current recording
			const completed = await this.stop(currentFieldId);

			// Clear batch state
			console.log('[JobService] Clearing batch state');
			this._batchPending = null;
			await this._saveBatchPending();

			console.log('[JobService] Batch completed and cleared');
			return completed;
		} catch (error) {
			// Clear batch state even on error to prevent stuck state
			console.error('[JobService] Error during batch completion, clearing batch state:', error);
			this._batchPending = null;
			await this._saveBatchPending();
			throw error;
		}
	}

	/**
	 * Get current batch status.
	 *
	 * Returns a summary of the active batch including the batch id, the currently
	 * recording field, the field index, total fields and a list of pending fields.
	 *
	 * @returns {Object|null} Batch status or `null` if no active batch.
	 */
	getBatchStatus() {
		if (!this._batchPending) return null;

		// Get current active recording
		const currentFieldId = Array.from(this._active.keys())[0];
		const currentRecording = currentFieldId ? this._active.get(currentFieldId) : null;

		// Calculate total batch elapsed time (accumulated + current field)
		const accumulatedTime = this._batchPending.accumulatedTime || 0;
		const currentFieldTime = currentRecording?.elapsedTime || 0;
		const totalElapsedTime = accumulatedTime + currentFieldTime;

		return {
			batchId: this._batchPending.id,
			currentFieldId: currentRecording?.fieldId || null,
			fieldIndex: currentRecording?.batch?.fieldIndex ?? 0,
			totalFields: this._batchPending.fieldIds.length,
			pendingFields: this._batchPending.pending.map(p => ({
				fieldId: p.fieldId,
				fieldName: p.fieldName,
				fieldIndex: p.fieldIndex,
			})),
			// Total elapsed time across all fields in the batch
			totalElapsedTime,
			accumulatedTime,
			batchStartTime: this._batchPending.batchStartTime,
		};
	}

	/**
	 * Check if a batch is currently active
	 * @returns {boolean}
	 */
	isBatchActive() {
		return this._batchPending !== null;
	}

	/**
	 * Check whether a given field ID is part of the currently active batch.
	 *
	 * Returns true if the field is the current active field for the batch, if
	 * it's in the pending list, or if it appears in the batch's fieldIds (even
	 * if it has already been completed).
	 *
	 * @param {string|number} fieldId - Field ID to check.
	 * @returns {boolean} `true` when the field is part of the active batch.
	 */
	isFieldInActiveBatch(fieldId) {
		if (!this._batchPending) return false;

		const fid = str(fieldId);

		// Check if it's the current active field
		const currentFieldId = Array.from(this._active.keys())[0];
		if (currentFieldId && currentFieldId === fid) {
			const rec = this._active.get(currentFieldId);
			if (rec?.batch?.id === this._batchPending.id) {
				return true;
			}
		}

		// Check if it's in the pending list
		if (this._batchPending.pending.some(p => str(p.fieldId) === fid)) {
			return true;
		}

		// Check if it's in the batch's field IDs (includes completed fields)
		if (this._batchPending.fieldIds.some(id => str(id) === fid)) {
			return true;
		}

		return false;
	}

	// ============================================================
	// PUBLIC API: QUERIES
	// ============================================================

	/**
	 * Get the active recording for a field.
	 *
	 * Returns a shallow clone of the in-memory recording object for the
	 * specified field or `null` if none exists.
	 *
	 * @param {string|number} fieldId - Field ID to query.
	 * @returns {Object|null} Recording object or `null`.
	 */
	getActive(fieldId) {
		const fid = str(fieldId);
		const rec = this._active.get(fid);
		return rec ? { ...rec } : null;
	}

	/**
	 * Get all active recordings.
	 *
	 * Returns a map-like object where keys are field IDs and values are
	 * shallow clones of the recording objects.
	 *
	 * @returns {Object} Map of `fieldId -> recording`.
	 */
	getAllActive() {
		const result = {};
		this._active.forEach((rec, fid) => {
			result[fid] = { ...rec };
		});
		return result;
	}

	/**
	 * Check if a field currently has an active recording.
	 *
	 * @param {string|number} fieldId - Field ID to check.
	 * @returns {boolean}
	 */
	hasActive(fieldId) {
		return this._active.has(str(fieldId));
	}

	/**
	 * Get completed jobs for a field from the local cache.
	 *
	 * Supports filtering by job type, a 'since' timestamp and result limit.
	 * Results are returned sorted by `endTime` descending.
	 *
	 * @param {string|number} fieldId - Field ID to query history for.
	 * @param {Object} [options]
	 * @param {string|null} [options.type=null] - Optional job type filter.
	 * @param {number} [options.limit=50] - Maximum number of results to return.
	 * @param {string|Date|null} [options.since=null] - If provided, only jobs ending after this date are returned.
	 * @returns {Promise<Array<Object>>} Array of job objects from the cache.
	 */
	async getHistory(fieldId, options = {}) {
		await this._ensureInit();
		const { type = null, limit = 50, since = null } = options;
		const fid = str(fieldId);

		const jobIds = this._index.byField.get(fid);
		if (!jobIds?.size) return [];

		const jobs = await this._batchLoadCache(Array.from(jobIds));
		let results = jobs.filter(j => j !== null);

		// Filter by type
		if (type) {
			results = results.filter(j => (j.type || j.jobType) === type);
		}

		// Filter by date
		if (since) {
			const sinceTime = new Date(since).getTime();
			results = results.filter(j => new Date(j.endedAt || j.endTime).getTime() >= sinceTime);
		}

		// Sort by endedAt/endTime descending
		results.sort((a, b) => new Date(b.endedAt || b.endTime) - new Date(a.endedAt || a.endTime));

		// Limit
		if (limit) {
			results = results.slice(0, limit);
		}

		return results;
	}

	/**
	 * Get all cached jobs for a specific job type.
	 *
	 * @param {string} jobType - The job type to query (e.g. 'spray').
	 * @param {Object} [options]
	 * @param {number} [options.limit=50]
	 * @param {string|Date|null} [options.since=null]
	 * @returns {Promise<Array<Object>>} Array of job objects matching the type.
	 */
	async getByType(jobType, options = {}) {
		await this._ensureInit();
		const { limit = 50, since = null } = options;

		const jobIds = this._index.byType.get(jobType);
		if (!jobIds?.size) return [];

		const jobs = await this._batchLoadCache(Array.from(jobIds));
		let results = jobs.filter(j => j !== null);

		if (since) {
			const sinceTime = new Date(since).getTime();
			results = results.filter(j => new Date(j.endedAt || j.endTime).getTime() >= sinceTime);
		}

		results.sort((a, b) => new Date(b.endedAt || b.endTime) - new Date(a.endedAt || a.endTime));

		if (limit) {
			results = results.slice(0, limit);
		}

		return results;
	}

	/**
	 * Get all cached jobs across all fields.
	 *
	 * Returns all jobs stored in the local cache, sorted by `endTime` descending.
	 * Useful for offline mode to show previously recorded jobs.
	 *
	 * @param {Object} [options]
	 * @param {number} [options.limit=100] - Maximum number of results to return.
	 * @param {string|null} [options.search=null] - Optional search filter (matches template name or type).
	 * @returns {Promise<Array<Object>>} Array of job objects from the cache.
	 */
	async getAllCachedJobs(options = {}) {
		await this._ensureInit();
		const { limit = 100, search = null } = options;

		// Collect all unique job IDs from the index
		const allJobIds = new Set();
		this._index.byField.forEach(jobIds => {
			jobIds.forEach(id => allJobIds.add(id));
		});

		if (allJobIds.size === 0) return [];

		const jobs = await this._batchLoadCache(Array.from(allJobIds));
		let results = jobs.filter(j => j !== null);

		// Filter by search query
		if (search) {
			const lowerSearch = search.toLowerCase();
			results = results.filter(j => {
				const templateName = j.template?.name?.toLowerCase() || '';
				const jobType = (j.type || j.jobType || '').toLowerCase();
				return templateName.includes(lowerSearch) || jobType.includes(lowerSearch);
			});
		}

		// Sort by endedAt/endTime descending
		results.sort((a, b) => new Date(b.endedAt || b.endTime) - new Date(a.endedAt || a.endTime));

		// Limit
		if (limit) {
			results = results.slice(0, limit);
		}

		return results;
	}

	/**
	 * Update a local (non-synced) job.
	 *
	 * This allows editing jobs that haven't been synced to the server yet.
	 * The updates are merged into the existing job and saved to local storage.
	 * When the job eventually syncs, it will include these updates.
	 *
	 * @param {string} jobId - The local job ID (not server _id).
	 * @param {Object} updates - Object with fields to update.
	 * @returns {Promise<Object|null>} The updated job or null if not found.
	 */
	async updateJob(jobId, updates) {
		await this._ensureInit();

		const key = `${this._prefix}job_${jobId}`;
		try {
			const json = await Storage.getItem(key);
			if (!json) {
				console.warn('[JobService] Job not found for update:', jobId);
				return null;
			}

			const job = JSON.parse(json);

			// Don't allow updating already synced jobs via this method
			if (job.syncStatus === 'synced' || job._id) {
				console.warn('[JobService] Cannot update synced job via updateJob:', jobId);
				return null;
			}

			// Merge updates into job
			const updatedJob = { ...job, ...updates, updatedAt: new Date().toISOString() };

			// Save back to storage
			await Storage.setItem(key, JSON.stringify(updatedJob));

			// Also update pending queue if job is there
			const pendingJson = await Storage.getItem(this._pendingKey);
			if (pendingJson) {
				const pending = JSON.parse(pendingJson);
				const idx = pending.findIndex(p => p.id === jobId);
				if (idx !== -1) {
					pending[idx] = { ...pending[idx], ...updates };
					await Storage.setItem(this._pendingKey, JSON.stringify(pending));
				}
			}

			this._emit('change', { type: 'jobUpdated', jobId, job: updatedJob });

			return updatedJob;
		} catch (err) {
			console.error('[JobService] Failed to update job:', err);
			return null;
		}
	}

	/**
	 * Get a single job by ID from local cache.
	 *
	 * @param {string} jobId - The job ID.
	 * @returns {Promise<Object|null>} The job or null if not found.
	 */
	async getJob(jobId) {
		await this._ensureInit();

		const key = `${this._prefix}job_${jobId}`;
		try {
			const json = await Storage.getItem(key);
			if (!json) return null;
			return JSON.parse(json);
		} catch (err) {
			console.error('[JobService] Failed to get job:', err);
			return null;
		}
	}

	// ============================================================
	// PUBLIC API: EVENTS
	// ============================================================

	/**
	 * Subscribe to events
	 * Events: 'ready', 'tick', 'change', 'sync'
	 */
	on(callback) {
		this._listeners.add(callback);
		return () => this._listeners.delete(callback);
	}

	/**
	 * Alias for `on()` - subscribes to JobService events.
	 *
	 * @param {(event: string, data: any) => void} callback
	 * @returns {Function} Unsubscribe function.
	 */
	addListener(callback) {
		return this.on(callback);
	}

	// ============================================================
	// PUBLIC API: LIFECYCLE
	// ============================================================

	/**
	 * Cleanup resources and detach listeners.
	 *
	 * Stops the internal timer, the periodic cleanup timer, removes network
	 * and app state listeners and clears any registered event listeners. This
	 * is useful for components/tests to release resources when the service is no longer required.
	 */
	cleanup() {
		this._stopTimer();
		if (this._cleanupTimer) {
			clearInterval(this._cleanupTimer);
			this._cleanupTimer = null;
		}
		this._teardownListeners();
		this._listeners.clear();
	}

	/**
	 * Force hydration from the server for specific fields.
	 *
	 * This will fetch recent jobs for the provided `fieldIds` and merge them
	 * into the local cache (skipping existing entries). If `fieldIds` is omitted
	 * or empty the method will still ensure initialization but will no-op.
	 *
	 * @param {Array<string|number>} fieldIds - Field IDs to hydrate from server.
	 * @returns {Promise<void>}
	 */
	async hydrate(fieldIds) {
		await this._ensureInit();
		return this._hydrate(fieldIds, true);
	}

	/**
	 * Get internal stats useful for debugging and dev tools.
	 *
	 * Includes counts for active recordings, cached jobs, pending sync queue length and tracked fields.
	 *
	 * @returns {Promise<Object>} { activeCount, cachedCount, pendingSync, fieldCount }
	 */
	async getStats() {
		await this._ensureInit();
		const pending = await this._loadPending();

		let cachedCount = 0;
		for (const ids of this._index.byField.values()) {
			cachedCount += ids.size;
		}

		return {
			activeCount: this._active.size,
			cachedCount,
			pendingSync: pending.length,
			fieldCount: this._index.byField.size,
		};
	}

	// ============================================================
	// TIMER
	// ============================================================

	_hasRunning() {
		for (const rec of this._active.values()) {
			if (rec.status === 'running') return true;
		}
		return false;
	}

	_startTimer() {
		if (this._timer) return;

		this._tickCount = 0;
		this._timer = setInterval(() => {
			const t = Date.now();

			// Update elapsed time for running recordings
			this._active.forEach(rec => {
				if (rec.status === 'running') {
					rec.elapsedTime += t - rec.lastTick;
					rec.lastTick = t;
				}
			});

			// Periodic save
			this._tickCount++;
			if (this._tickCount >= CONFIG.SAVE_INTERVAL_TICKS) {
				this._saveActive().catch(() => { });
				this._tickCount = 0;
			}

			this._emit('tick', this.getAllActive());
		}, CONFIG.TIMER_INTERVAL_MS);
	}

	_stopTimer() {
		if (this._timer) {
			clearInterval(this._timer);
			this._timer = null;
		}
	}

	// ============================================================
	// ACTIVE RECORDINGS STORAGE
	// ============================================================

	async _loadActive() {
		try {
			const json = await Storage.getItem(STORAGE.ACTIVE);
			if (!json) return;

			const data = JSON.parse(json);
			const t = Date.now();

			Object.entries(data).forEach(([fid, rec]) => {
				if (rec.status === 'running' && rec.lastTick) {
					rec.elapsedTime += t - rec.lastTick;
				}
				rec.lastTick = t;
				this._active.set(fid, rec);
			});

			console.log('[JobService] Loaded', this._active.size, 'active recordings');

			// Notify listeners that recordings were loaded
			if (this._active.size > 0) {
				this._emit('change', { type: 'loaded' });
			}
		} catch (err) {
			console.error('[JobService] Failed to load active:', err);
		}
	}

	async _saveActive() {
		const data = {};
		this._active.forEach((rec, fid) => {
			data[fid] = rec;
		});
		await Storage.setItem(STORAGE.ACTIVE, JSON.stringify(data));
	}

	// ============================================================
	// BATCH PENDING STORAGE
	// ============================================================

	async _loadBatchPending() {
		try {
			const json = await Storage.getItem(STORAGE.BATCH_PENDING);
			if (!json) return;

			this._batchPending = JSON.parse(json);
			console.log('[JobService] Loaded batch pending:', this._batchPending?.id);
		} catch (err) {
			console.error('[JobService] Failed to load batch pending:', err);
		}
	}

	async _saveBatchPending() {
		try {
			if (this._batchPending === null) {
				console.log('[JobService] Clearing batch pending from storage');
				await Storage.removeItem(STORAGE.BATCH_PENDING);
			} else {
				console.log('[JobService] Saving batch pending:', this._batchPending.id);
				await Storage.setItem(STORAGE.BATCH_PENDING, JSON.stringify(this._batchPending));
			}
		} catch (err) {
			console.error('[JobService] Failed to save batch pending:', err);
		}
	}

	// ============================================================
	// COMPLETION RECOVERY (CRASH PROTECTION)
	// ============================================================

	async _addCompleting(job) {
		try {
			const json = await Storage.getItem(STORAGE.COMPLETING);
			const list = json ? JSON.parse(json) : [];
			list.push({ id: job.id, job, timestamp: Date.now() });
			await Storage.setItem(STORAGE.COMPLETING, JSON.stringify(list));
		} catch (err) {
			console.error('[JobService] Failed to save completing:', err);
		}
	}

	async _removeCompleting(jobId) {
		try {
			const json = await Storage.getItem(STORAGE.COMPLETING);
			if (!json) return;
			const list = JSON.parse(json).filter(c => c.id !== jobId);
			await Storage.setItem(STORAGE.COMPLETING, JSON.stringify(list));
		} catch (err) {
			console.error('[JobService] Failed to remove completing:', err);
		}
	}

	async _recoverCompletions() {
		try {
			const json = await Storage.getItem(STORAGE.COMPLETING);
			if (!json) return;

			const list = JSON.parse(json);
			if (!list.length) return;

			console.log('[JobService] Recovering', list.length, 'interrupted completions');

			for (const { id, job } of list) {
				// Check if already cached
				const existing = await Storage.getItem(`${STORAGE.CACHE_PREFIX}${id}`);
				if (existing) {
					await this._removeCompleting(id);
					continue;
				}

				// Complete the job
				await this._cacheJob(job);
				await this._addPending(job);
				await this._removeCompleting(id);
			}
		} catch (err) {
			console.error('[JobService] Failed to recover completions:', err);
		}
	}

	// ============================================================
	// LOCAL CACHE
	// ============================================================

	async _cacheJob(job) {
		const fid = str(job.fieldId);
		const key = `${STORAGE.CACHE_PREFIX}${job.id}`;

		const cacheEntry = {
			...job,
			cachedAt: now(),
			expiresAt: new Date(Date.now() + CONFIG.CACHE_TTL_DAYS * 86400000).toISOString(),
			syncStatus: 'pending',  // 'pending' | 'synced' | 'failed'
		};

		// Enforce per-field limit
		const fieldJobs = this._index.byField.get(fid);
		if (fieldJobs && fieldJobs.size >= CONFIG.MAX_CACHED_PER_FIELD) {
			await this._removeOldestCached(fid);
		}

		// Save entry
		await Storage.setItem(key, JSON.stringify(cacheEntry));

		// Update index
		if (!this._index.byField.has(fid)) {
			this._index.byField.set(fid, new Set());
		}
		this._index.byField.get(fid).add(job.id);

		const jobType = job.type || job.jobType;
		if (!this._index.byType.has(jobType)) {
			this._index.byType.set(jobType, new Set());
		}
		this._index.byType.get(jobType).add(job.id);

		await this._saveIndex();
	}

	async _markSynced(jobId, serverJobId = null) {
		const key = `${STORAGE.CACHE_PREFIX}${jobId}`;
		try {
			const json = await Storage.getItem(key);
			if (!json) return;

			const job = JSON.parse(json);
			job.syncStatus = 'synced';
			job.syncedAt = now();
			if (serverJobId) job.serverJobId = serverJobId;

			await Storage.setItem(key, JSON.stringify(job));
			this._emit('jobSynced', { jobId, serverJobId, status: 'synced' });
		} catch (err) {
			console.error('[JobService] Failed to mark synced:', err);
		}
	}

	async _removeOldestCached(fieldId) {
		const jobIds = this._index.byField.get(fieldId);
		if (!jobIds?.size) return;

		const jobs = await this._batchLoadCache(Array.from(jobIds));
		const valid = jobs.filter(j => j !== null);
		if (!valid.length) return;

		// Sort oldest first
		valid.sort((a, b) => new Date(a.endedAt || a.endTime) - new Date(b.endedAt || b.endTime));
		const oldest = valid[0];

		await this._removeCached(oldest.id);
	}

	async _removeCached(jobId) {
		const key = `${STORAGE.CACHE_PREFIX}${jobId}`;
		try {
			const json = await Storage.getItem(key);
			if (!json) return;

			const job = JSON.parse(json);
			const fid = str(job.fieldId);

			// Remove from storage
			await Storage.removeItem(key);

			// Update index
			this._index.byField.get(fid)?.delete(jobId);
			const jobType = job.type || job.jobType;
			this._index.byType.get(jobType)?.delete(jobId);

			await this._saveIndex();
		} catch (err) {
			console.error('[JobService] Failed to remove cached:', err);
		}
	}

	async _batchLoadCache(jobIds) {
		if (!jobIds.length) return [];

		const results = [];
		for (let i = 0; i < jobIds.length; i += CONFIG.BATCH_SIZE) {
			const batch = jobIds.slice(i, i + CONFIG.BATCH_SIZE);
			const keys = batch.map(id => `${STORAGE.CACHE_PREFIX}${id}`);
			const pairs = await Storage.multiGet(keys);

			for (const [, json] of pairs) {
				if (json) {
					try {
						results.push(JSON.parse(json));
					} catch {
						// Skip corrupt entries
					}
				}
			}
		}
		return results;
	}

	// ============================================================
	// INDEX
	// ============================================================

	async _loadIndex() {
		try {
			const json = await Storage.getItem(STORAGE.INDEX);
			if (!json) return;

			const data = JSON.parse(json);

			this._index.byField.clear();
			if (data.byField) {
				Object.entries(data.byField).forEach(([fid, ids]) => {
					this._index.byField.set(fid, new Set(ids));
				});
			}

			this._index.byType.clear();
			if (data.byType) {
				Object.entries(data.byType).forEach(([type, ids]) => {
					this._index.byType.set(type, new Set(ids));
				});
			}

			console.log('[JobService] Loaded index:', this._index.byField.size, 'fields');
		} catch (err) {
			console.error('[JobService] Failed to load index:', err);
		}
	}

	async _saveIndex() {
		const data = {
			byField: {},
			byType: {},
		};

		this._index.byField.forEach((ids, fid) => {
			data.byField[fid] = Array.from(ids);
		});
		this._index.byType.forEach((ids, type) => {
			data.byType[type] = Array.from(ids);
		});

		await Storage.setItem(STORAGE.INDEX, JSON.stringify(data));
	}

	// ============================================================
	// SERVER SYNC
	// ============================================================

	async _loadPending() {
		try {
			const json = await Storage.getItem(STORAGE.PENDING);
			return json ? JSON.parse(json) : [];
		} catch {
			return [];
		}
	}

	/**
	 * Get all pending jobs waiting to be synced to the server.
	 *
	 * Primarily intended for debugging and developer tooling. Each entry is a cached job object pending sync.
	 *
	 * @returns {Promise<Array<Object>>} Array of pending job objects.
	 */
	async getPendingJobs() {
		return await this._loadPending();
	}

	/**
	 * Manually clear any saved batch pending state.
	 *
	 * This is a helper for debugging or recovery when an incomplete batch gets stuck.
	 * It clears the in-memory batch object and its persisted form in Storage.
	 *
	 * @returns {Promise<void>}
	 */
	async clearBatchPending() {
		console.log('[JobService] Manually clearing batch pending');
		this._batchPending = null;
		await this._saveBatchPending();
		console.log('[JobService] Batch pending cleared');
	}

	async _savePending(list) {
		await Storage.setItem(STORAGE.PENDING, JSON.stringify(list));
	}

	async _addPending(job) {
		const pending = await this._loadPending();
		if (pending.some(p => p.id === job.id)) return;
		pending.push(job);
		await this._savePending(pending);
	}

	async _removePending(jobId) {
		const pending = await this._loadPending();
		await this._savePending(pending.filter(p => p.id !== jobId));
	}

	async _syncPending() {
		if (this._syncing) return;
		this._syncing = true;

		try {
			const pending = await this._loadPending();
			if (!pending.length) return;

			console.log('[JobService] Syncing', pending.length, 'jobs');
			console.log('[JobService] Pending job IDs:', pending.map(j => `${j.id} (${j.jobType})`));

			const now = Date.now();

			for (const job of pending) {
				// Check if this job should be retried now
				const retryInfo = this._retryMeta[job.id];

				if (retryInfo) {
					// Check if we've exceeded max attempts
					if (retryInfo.attempts >= CONFIG.SYNC_RETRY_MAX_ATTEMPTS) {
						console.warn('[JobService] Job', job.id, 'exceeded max retry attempts. Keeping in queue.');
						continue;
					}

					// Check if enough time has passed since last attempt
					if (retryInfo.nextRetry && now < retryInfo.nextRetry) {
						const waitTime = Math.round((retryInfo.nextRetry - now) / 1000);
						console.log('[JobService] Skipping job', job.id, `- retry in ${waitTime}s`);
						continue;
					}
				}

				try {
					const result = await this._syncOne(job);
					if (result.success) {
						await this._removePending(job.id);
						await this._markSynced(job.id, result.serverJobId);

						// Emit sync event with updates if present (guard against malformed responses)
						if (result.updates && typeof result.updates === 'object' && Object.keys(result.updates).length > 0) {
							console.log('[JobService] Emitting sync event with updates:', Object.keys(result.updates));
							this._emit('sync', {
								jobId: job.id,
								fieldId: job.fieldId,
								updates: result.updates
							});
						}

						// Clear retry metadata on success
						delete this._retryMeta[job.id];
						await this._saveRetryMeta();
					}
				} catch (err) {
					console.error('[JobService] Failed to sync job', job.id, err);
					// Update retry metadata with exponential backoff
					await this._recordRetryAttempt(job.id);
				}
			}
		} finally {
			this._syncing = false;
		}
	}

	async _syncOne(job) {
		const { idempotencyKey, lastTick, ...payload } = job;

		// Ensure we send 'type', not 'jobType'
		if (payload.jobType && !payload.type) {
			payload.type = payload.jobType;
			delete payload.jobType;
		}

		// Ensure elapsedTime is never null
		if (payload.elapsedTime == null) {
			console.warn('[JobService] elapsedTime was null for job', job.id, '- setting to 0');
			payload.elapsedTime = 0;
		}

		// Clean up undefined/null values that shouldn't be sent
		Object.keys(payload).forEach(key => {
			if (payload[key] === undefined) {
				delete payload[key];
			}
		});

		console.log('[JobService] Syncing job:', {
			id: payload.id,
			type: payload.type,
			template: payload.template,
			elapsedTime: payload.elapsedTime
		});
		console.log('[JobService] Full payload:', JSON.stringify(payload, null, 2));

		const response = await api(`${BASE_URL}/job/record`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Idempotency-Key': idempotencyKey || job.id,
			},
			body: JSON.stringify(payload),
		});

		// 409 = already exists, treat as success
		if (response.status === 409) {
			return { success: true, serverJobId: job.id, updates: null };
		}

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[JobService] Sync failed:', response.status, errorText);
			throw new Error(`Sync failed: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		const serverJob = data.PAYLOAD;
		const updates = data.UPDATES || null;  // Extract UPDATES if present

		// Server returns { job: { _id: "..." } } in PAYLOAD, so check nested .job first
		const serverJobId = serverJob?.job?._id || serverJob?._id || serverJob?.id || job.id;
		console.log('[JobService] Extracted serverJobId:', serverJobId, 'from PAYLOAD:', JSON.stringify(serverJob).slice(0, 100));

		return {
			success: true,
			serverJobId,
			serverJob,
			updates  // Pass through to caller
		};
	}

	// ============================================================
	// RETRY LOGIC WITH EXPONENTIAL BACKOFF
	// ============================================================

	async _loadRetryMeta() {
		try {
			const data = await Storage.getItem(STORAGE.RETRY_META);
			this._retryMeta = data ? JSON.parse(data) : {};
		} catch (err) {
			console.error('[JobService] Failed to load retry meta:', err);
			this._retryMeta = {};
		}
	}

	async _saveRetryMeta() {
		try {
			await Storage.setItem(STORAGE.RETRY_META, JSON.stringify(this._retryMeta));
		} catch (err) {
			console.error('[JobService] Failed to save retry meta:', err);
		}
	}

	async _recordRetryAttempt(jobId) {
		const now = Date.now();
		const retryInfo = this._retryMeta[jobId] || { attempts: 0, lastAttempt: null, nextRetry: null };

		// Increment attempt counter
		retryInfo.attempts += 1;
		retryInfo.lastAttempt = now;

		// Calculate next retry time with exponential backoff + jitter
		const baseDelay = CONFIG.SYNC_RETRY_BASE_DELAY_MS * Math.pow(
			CONFIG.SYNC_BACKOFF_MULTIPLIER,
			retryInfo.attempts - 1
		);
		const cappedDelay = Math.min(baseDelay, CONFIG.SYNC_RETRY_MAX_DELAY_MS);

		// Add jitter to prevent thundering herd (±20% randomness)
		const jitter = cappedDelay * CONFIG.SYNC_RETRY_JITTER_FACTOR * (Math.random() * 2 - 1);
		const delay = Math.round(cappedDelay + jitter);

		retryInfo.nextRetry = now + delay;

		this._retryMeta[jobId] = retryInfo;
		await this._saveRetryMeta();

		console.log('[JobService] Retry scheduled for job', jobId, {
			attempt: retryInfo.attempts,
			nextRetryIn: `${Math.round(delay / 1000)}s`,
			maxAttempts: CONFIG.SYNC_RETRY_MAX_ATTEMPTS
		});
	}

	_startBackgroundSync() {
		if (this._syncTimer) return;

		console.log('[JobService] Starting background sync timer');
		this._syncTimer = setInterval(() => {
			this._syncPending().catch(e => console.error('[JobService] Background sync failed:', e));
		}, CONFIG.SYNC_BACKGROUND_INTERVAL_MS);
	}

	_stopBackgroundSync() {
		if (this._syncTimer) {
			clearInterval(this._syncTimer);
			this._syncTimer = null;
			console.log('[JobService] Stopped background sync timer');
		}
	}

	_setupNetworkListener() {
		// Listen for network connectivity changes
		this._netInfoUnsubscribe = NetInfo.addEventListener(state => {
			console.log('[JobService] Network state changed:', {
				connected: state.isConnected,
				type: state.type
			});

			// When connection is restored, trigger immediate sync
			if (state.isConnected) {
				console.log('[JobService] Network restored - triggering sync');
				this._syncPending().catch(e => console.error('[JobService] Network sync failed:', e));
			}
		});
	}

	_setupAppStateListener() {
		// Listen for app state changes (foreground/background)
		this._appStateSubscription = AppState.addEventListener('change', nextAppState => {
			console.log('[JobService] App state changed:', nextAppState);

			// When app comes to foreground, trigger sync
			if (nextAppState === 'active') {
				console.log('[JobService] App foregrounded - triggering sync');
				this._syncPending().catch(e => console.error('[JobService] Foreground sync failed:', e));
			}
		});
	}

	_teardownListeners() {
		if (this._netInfoUnsubscribe) {
			this._netInfoUnsubscribe();
			this._netInfoUnsubscribe = null;
		}

		if (this._appStateSubscription) {
			this._appStateSubscription.remove();
			this._appStateSubscription = null;
		}

		this._stopBackgroundSync();
	}

	// ============================================================
	// HYDRATION (from server)
	// ============================================================

	async _hydrate(fieldIds, force = false) {
		try {
			const meta = await this._loadMeta();
			const elapsed = Date.now() - (meta.lastHydration || 0);

			if (!force && elapsed < CONFIG.HYDRATION_INTERVAL_MS) {
				console.log('[JobService] Hydration not needed');
				return;
			}

			console.log('[JobService] Hydrating from server for', fieldIds.length, 'fields');

			const response = await api(
				`${BASE_URL}/job/recent-sprays?fieldIds=${encodeURIComponent(fieldIds.join(','))}`,
				{ method: 'GET' }
			);

			if (!response.ok) {
				throw new Error(`Server returned ${response.status}`);
			}

			const data = await response.json();
			if (data.HEADERS?.STATUS_CODE !== 'OK' || !Array.isArray(data.PAYLOAD)) {
				return;
			}

			let added = 0;
			for (const serverJob of data.PAYLOAD) {
				const exists = await Storage.getItem(`${STORAGE.CACHE_PREFIX}${serverJob._id}`);
				if (exists) continue;

				const job = this._convertServerJob(serverJob);
				if (job) {
					await this._cacheJob(job);
					added++;
				}
			}

			console.log('[JobService] Hydrated', added, 'jobs');
			await this._saveMeta({ ...meta, lastHydration: Date.now() });
		} catch (err) {
			console.error('[JobService] Hydration failed:', err);
		}
	}

	_convertServerJob(serverJob) {
		return {
			id: serverJob._id || serverJob.id,
			fieldId: str(serverJob.fieldId),
			type: serverJob.type || serverJob.jobType,
			startedAt: serverJob.startedAt || serverJob.startTime,
			endedAt: serverJob.endedAt || serverJob.endTime,
			elapsedTime: serverJob.elapsedTime || 0,
			status: 'completed',
			data: serverJob.data || (serverJob.sprayData ? { spray: serverJob.sprayData } : {}),
			cachedAt: now(),
			expiresAt: new Date(Date.now() + CONFIG.CACHE_TTL_DAYS * 86400000).toISOString(),
			syncStatus: 'synced',
			syncedAt: now(),
			serverJobId: serverJob._id || serverJob.id,
		};
	}

	async _loadMeta() {
		try {
			const json = await Storage.getItem(STORAGE.META);
			return json ? JSON.parse(json) : {};
		} catch {
			return {};
		}
	}

	async _saveMeta(meta) {
		await Storage.setItem(STORAGE.META, JSON.stringify(meta));
	}

	// ============================================================
	// CLEANUP
	// ============================================================

	_startCleanupTimer() {
		if (this._cleanupTimer) return;

		this._cleanupTimer = setInterval(() => {
			this._runCleanup().catch(e => console.error('[JobService] Cleanup failed:', e));
		}, CONFIG.CLEANUP_INTERVAL_MS);
	}

	async _runCleanup() {
		const t = Date.now();
		let removed = 0;

		for (const [fid, jobIds] of this._index.byField) {
			const jobs = await this._batchLoadCache(Array.from(jobIds));

			for (const job of jobs) {
				if (!job) continue;

				// Don't delete unsynced
				if (job.syncStatus === 'pending') continue;

				// Check expiry
				const expiry = new Date(job.expiresAt).getTime();
				if (t > expiry) {
					await this._removeCached(job.id);
					removed++;
				}
			}
		}

		if (removed > 0) {
			console.log('[JobService] Cleanup removed', removed, 'expired jobs');
		}
	}

	// ============================================================
	// RESET (for logout/account deletion)
	// ============================================================

	/**
	 * Reset all job data (for logout/account switch)
	 * Clears in-memory state, Storage, and stops all timers
	 */
	async reset() {
		console.log('[JobService] Resetting...');

		// Stop timers and listeners
		this._stopTimer();
		if (this._cleanupTimer) {
			clearInterval(this._cleanupTimer);
			this._cleanupTimer = null;
		}
		this._teardownListeners();

		// Clear in-memory state
		this._active.clear();
		this._index = { byField: new Map(), byType: new Map() };
		this._batchPending = null;
		this._stopping.clear();
		this._tickCount = 0;
		this._retryMeta = {};

		// Clear storage
		try {
			const allKeys = await Storage.getAllKeys();
			const jobKeys = allKeys.filter(k => k.startsWith('@jobs:'));
			if (jobKeys.length > 0) {
				await Storage.multiRemove(jobKeys);
			}
		} catch (err) {
			console.error('[JobService] Failed to clear storage:', err);
		}

		// Reset init flag so it can be re-initialized
		this._initialized = false;
		this._initPromise = null;

		// Notify listeners
		this._emit('change', { type: 'reset' });

		console.log('[JobService] Reset complete');
	}

	// ============================================================
	// EVENTS
	// ============================================================

	_emit(event, data = null) {
		for (const listener of this._listeners) {
			try {
				listener(event, data);
			} catch (err) {
				console.error('[JobService] Listener error:', err);
			}
		}
	}
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

const jobService = new JobService();

if (typeof global !== 'undefined') {
	global.JobService = jobService;
}

export default jobService;