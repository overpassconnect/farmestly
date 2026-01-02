class ReportPollingService {
  constructor() {
    this._intervalId = null;
    this._jobId = null;
    this._callbacks = {};
    this._pollInterval = 2000; // 2 seconds
    this._api = null;
  }

  start(jobId, api, callbacks) {
    // Clear any existing polling loop
    this.stop();

    // Store parameters
    this._jobId = jobId;
    this._api = api;
    this._callbacks = callbacks;

    // Immediately do first status check
    this._poll();

    // Set up interval for subsequent checks
    this._intervalId = setInterval(() => this._poll(), this._pollInterval);
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._jobId = null;
  }

  isPolling() {
    return this._intervalId !== null;
  }

  async _poll() {
    // Early return if polling was stopped
    if (!this._jobId || !this._api) {
      return;
    }

    try {
      // Call status endpoint
      const result = await this._api(`/report/status/${this._jobId}`);

      // Handle network/server errors
      if (!result.ok) {
        if (this._callbacks.onError) {
          this._callbacks.onError(result.error || 'POLL_ERROR');
        }
        this.stop();
        return;
      }

      const { status, result: jobResult, error } = result;

      // Handle different job statuses
      switch (status) {
        case 'pending':
        case 'processing':
          // Job still running - notify progress if callback exists
          if (this._callbacks.onProgress) {
            this._callbacks.onProgress(status);
          }
          // Keep polling
          break;

        case 'completed':
          // Job finished successfully
          if (this._callbacks.onComplete) {
            this._callbacks.onComplete(jobResult);
          }
          this.stop();
          break;

        case 'failed':
          // Job failed
          if (this._callbacks.onError) {
            this._callbacks.onError(error || 'REPORT_FAILED');
          }
          this.stop();
          break;

        case 'cancelled':
          // Job was cancelled (likely by user starting new report)
          // Stop silently without calling callbacks
          this.stop();
          break;

        default:
          // Unknown status - treat as error
          if (this._callbacks.onError) {
            this._callbacks.onError('UNKNOWN_STATUS');
          }
          this.stop();
          break;
      }
    } catch (error) {
      // Transient network issues shouldn't kill polling
      // Log but don't stop - next poll might succeed
      console.error('Poll error (non-fatal):', error);
    }
  }
}

// Export singleton instance
export default new ReportPollingService();
